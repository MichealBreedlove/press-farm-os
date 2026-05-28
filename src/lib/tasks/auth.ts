/**
 * Shared admin-gate helper for task API routes. Returns the user_id +
 * farm_id when authorized, or a NextResponse if not.
 *
 * Press Farm OS is single-tenant, so we always resolve to the single farm row.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthOk = { ok: true; userId: string; farmId: string };
export type AuthErr = { ok: false; res: NextResponse };

export async function requireAdmin(): Promise<AuthOk | AuthErr> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const admin = createAdminClient();
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id;
  if (!farmId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Farm not seeded" }, { status: 500 }),
    };
  }
  return { ok: true, userId: user.id, farmId };
}
