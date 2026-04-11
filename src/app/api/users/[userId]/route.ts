import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ userId: string }>;

/**
 * PATCH /api/users/[userId]
 * Body: { is_active: boolean }
 * Activate or deactivate a chef account. Admin only.
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { is_active?: boolean; password?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId } = await params;
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Update password via Supabase Auth admin API
  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      password: body.password,
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    // If only password was sent, return early
    if (body.is_active === undefined) {
      return NextResponse.json({ success: true });
    }
  }

  // Update profile active status
  const { data: updated, error } = await (admin as any)
    .from("profiles")
    .update({ is_active: body.is_active })
    .eq("id", userId)
    .select("id, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: updated });
}
