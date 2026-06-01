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
 * Body: { is_active: boolean }
 * Activate or deactivate a chef account. Admin only.
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let body: { is_active?: boolean; password?: string; generate_password?: boolean };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId } = await params;
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Reset password via Supabase Auth admin API. Either an admin-supplied
  // password, or `generate_password:true` to mint a strong temp one that we
  // return ONCE to the UI (same model as account creation — never logged/emailed).
  if (body.password || body.generate_password) {
    const supplied = body.password?.trim();
    if (supplied && supplied.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const generated = !supplied;
    const password = supplied || generateTempPassword();

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    // If only the password was changed, return it (when generated) so the admin
    // can share it once.
    if (body.is_active === undefined) {
      return NextResponse.json({ success: true, ...(generated ? { password, generated } : {}) });
    }
  }

  // Update profile active status
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ is_active: body.is_active })
    .eq("id", userId)
    .select("id, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: updated });
}
