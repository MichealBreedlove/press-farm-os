import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ userId: string }>;

/**
 * Strong, human-shareable temporary password (URL/voice-safe alphabet, no
 * ambiguous chars, dash-separated groups). Mirrors the generator in
 * POST /api/users. Never logged.
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

/**
 * PATCH /api/users/[userId]
 * Body (any subset — only the keys present are applied):
 *   { is_active }                          — activate / deactivate
 *   { password } | { generate_password }   — reset password (generated one returned once)
 *   { full_name, role, restaurant_id }     — edit account details
 * Admin only. Cannot modify your own account.
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let body: {
    is_active?: boolean;
    password?: string;
    generate_password?: boolean;
    full_name?: string;
    role?: string;
    restaurant_id?: string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId } = await params;
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Password reset (admin-supplied or generated). The generated one is
  //    returned ONCE so the admin can share it securely — never logged/emailed.
  let generatedPassword: string | undefined;
  if (body.password || body.generate_password) {
    const supplied = body.password?.trim();
    if (supplied && supplied.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const password = supplied || generateTempPassword();
    const { error: authError } = await admin.auth.admin.updateUserById(userId, { password });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
    if (!supplied) generatedPassword = password;
  }

  // 2. Profile fields — name / role / active. Only the keys present are touched.
  const profileUpdate: Record<string, unknown> = {};
  if (typeof body.full_name === "string") {
    const name = body.full_name.trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    profileUpdate.full_name = name;
  }
  if (body.role === "chef" || body.role === "receiver" || body.role === "harvester") {
    profileUpdate.role = body.role;
  }
  if (typeof body.is_active === "boolean") profileUpdate.is_active = body.is_active;
  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from("profiles").update(profileUpdate).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3. Restaurant assignment. Receivers/harvesters see all restaurants, so
  //    clear theirs; a chef is scoped to exactly one — replace any existing link.
  if (body.role === "receiver" || body.role === "harvester") {
    await admin.from("restaurant_users").delete().eq("user_id", userId);
  } else if (body.restaurant_id) {
    await admin.from("restaurant_users").delete().eq("user_id", userId);
    const { error } = await admin
      .from("restaurant_users")
      .upsert({ user_id: userId, restaurant_id: body.restaurant_id }, { onConflict: "user_id,restaurant_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ...(generatedPassword ? { password: generatedPassword, generated: true } : {}),
  });
}

/**
 * DELETE /api/users/[userId]
 * Permanently removes an account (auth user, which cascades to its profile +
 * restaurant links). Admin only; cannot delete yourself. Refuses cleanly when
 * the chef has order history (orders.chef_id RESTRICTs the delete) — those
 * accounts should be deactivated, not removed, so the history stays intact.
 */
export async function DELETE(_request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { userId } = await params;
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Pre-check the most common blocker so we can give a precise message rather
  // than a raw FK error. (created_by / last_edited_by / order_audit.actor_id
  // are also RESTRICT-guarded; if any remain, the auth delete below still
  // fails safely and we surface the friendly message.)
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("chef_id", userId);
  if (count && count > 0) {
    return NextResponse.json(
      { error: `Can't delete — this chef has ${count} order${count === 1 ? "" : "s"} on record. Deactivate the account instead.` },
      { status: 409 },
    );
  }

  // Deleting the auth user cascades to profiles + restaurant_users.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json(
      { error: "Can't delete — this account has linked records. Deactivate it instead." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
