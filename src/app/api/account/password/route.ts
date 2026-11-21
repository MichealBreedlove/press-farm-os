import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/api-auth";

const MIN_LENGTH = 8;

/**
 * POST /api/account/password — the signed-in user sets their own new
 * password. Used by /set-password when an account is flagged
 * `must_change_password` (a starter password that only works once); the
 * flag is cleared on success.
 *
 * Body: { password }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (!auth.ok) return auth.response;

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_LENGTH) {
    return NextResponse.json({ error: "too_short", min: MIN_LENGTH }, { status: 400 });
  }
  if (password.length > 72) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(auth.user.id, { password });
  if (error) {
    // Supabase rejects e.g. reusing the current password or a leaked one.
    return NextResponse.json({ error: "rejected", detail: error.message }, { status: 400 });
  }

  const { error: flagErr } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", auth.user.id);
  if (flagErr) {
    console.error("[ACCOUNT] clearing must_change_password failed", flagErr);
    return NextResponse.json({ error: "Saved, but please try again" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
