import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/users — List all chef profiles with restaurant assignments. Admin only.
 * POST /api/users — Create an individual chef/receiver account with a password. Admin only.
 */

/**
 * Generate a strong, human-shareable temporary password. ~72 bits of entropy
 * from a URL/voice-safe alphabet (no ambiguous 0/O/1/l/I), formatted in dash-
 * separated groups so it's easy to read aloud or paste once. Never logged.
 */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const groups = 3;
  const perGroup = 5;
  const bytes = randomBytes(groups * perGroup);
  const out: string[] = [];
  for (let g = 0; g < groups; g++) {
    let chunk = "";
    for (let i = 0; i < perGroup; i++) {
      chunk += alphabet[bytes[g * perGroup + i] % alphabet.length];
    }
    out.push(chunk);
  }
  return out.join("-");
}
export async function GET(_request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: profiles, error } = await admin
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
 * Body: { email, full_name, restaurant_id?, role?, password? }
 *
 * Creates an INDIVIDUAL account authenticated by email + password (replaces
 * the old magic-link invite flow). If `password` is omitted we generate a
 * strong temporary one server-side. The (temp) password is returned in the
 * response so the admin can share it ONCE, securely — it is never emailed or
 * logged. Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { email: string; full_name: string; restaurant_id?: string; role?: string; password?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const email = body.email?.trim().toLowerCase();
  const full_name = body.full_name;
  // Default role is "chef" for back-compat with the original form
  const role =
    body.role === "receiver" || body.role === "harvester" ? body.role : "chef";
  const restaurant_id = body.restaurant_id;

  if (!email || !full_name?.trim()) {
    return NextResponse.json({ error: "email and full_name required" }, { status: 400 });
  }
  // Chefs MUST have a restaurant; receivers and harvesters don't.
  if (role === "chef" && !restaurant_id) {
    return NextResponse.json({ error: "restaurant_id required for chef role" }, { status: 400 });
  }

  // Accept an admin-supplied password, otherwise generate a strong temp one.
  const suppliedPassword = body.password?.trim();
  if (suppliedPassword && suppliedPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const generated = !suppliedPassword;
  const password = suppliedPassword || generateTempPassword();

  const admin = createAdminClient();

  // Create the auth user directly with a password. email_confirm:true so the
  // account is immediately usable at /login (no confirmation email round-trip).
  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim() },
  });

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

  const newUserId = createData.user.id;

  // The handle_new_user trigger inserts a profiles row (role 'chef'). Upsert to
  // set full_name + the chosen role + is_active. This error was previously
  // swallowed — the prevent_role_escalation trigger once rejected the
  // service-role write and accounts got created with the wrong role while the
  // API reported success. Surface it (deleting the half-created auth user) so
  // a DB-side rejection can never hide again.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: newUserId, full_name: full_name.trim(), role, is_active: true }, { onConflict: "id" });
  if (profileErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Account setup failed (${profileErr.message}) — nothing was created, try again` },
      { status: 500 },
    );
  }

  // Link to restaurant only when chef — receivers/harvesters see all
  // restaurants by role.
  if (role === "chef" && restaurant_id) {
    const { error: linkErr } = await admin
      .from("restaurant_users")
      .upsert({ user_id: newUserId, restaurant_id }, { onConflict: "user_id,restaurant_id" });
    if (linkErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: `Restaurant link failed (${linkErr.message}) — nothing was created, try again` },
        { status: 500 },
      );
    }
  }

  // Return the (temp) password ONCE so the admin can share it securely. Do NOT
  // log it; do NOT email it. `generated` tells the UI whether to show the
  // "share this once" callout.
  return NextResponse.json(
    { userId: newUserId, role, email, password, generated },
    { status: 201 }
  );
}
