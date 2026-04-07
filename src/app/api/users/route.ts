import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/users — List all chef profiles with restaurant assignments. Admin only.
 * POST /api/users/invite — Invite a new chef via magic link. Admin only.
 */
export async function GET(_request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: profiles, error } = await (admin as any)
    .from("profiles")
    .select(`
      id, full_name, role, is_active, created_at,
      restaurant_users ( restaurant_id, restaurants ( name ) )
    `)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get auth emails for all users
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  for (const u of authUsers?.users ?? []) {
    emailMap[u.id] = u.email ?? "";
  }

  const users = (profiles ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap[p.id] ?? "",
    role: p.role,
    is_active: p.is_active,
    created_at: p.created_at,
    restaurants: (p.restaurant_users ?? []).map((ru: any) => ru.restaurants?.name).filter(Boolean),
  }));

  return NextResponse.json({ users });
}

/**
 * POST /api/users
 * Body: { email, full_name, restaurant_id }
 * Invites a new chef via Supabase magic link. Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email: string; full_name: string; restaurant_id: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { email, full_name, restaurant_id } = body;
  if (!email || !full_name?.trim() || !restaurant_id) {
    return NextResponse.json({ error: "email, full_name, and restaurant_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Invite via Supabase Auth (sends magic link email)
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name.trim() },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });

  const newUserId = inviteData.user.id;

  // Upsert profile
  await (admin as any)
    .from("profiles")
    .upsert({ id: newUserId, full_name: full_name.trim(), role: "chef", is_active: true }, { onConflict: "id" });

  // Link to restaurant
  await (admin as any)
    .from("restaurant_users")
    .upsert({ user_id: newUserId, restaurant_id }, { onConflict: "user_id,restaurant_id" });

  return NextResponse.json({ userId: newUserId }, { status: 201 });
}
