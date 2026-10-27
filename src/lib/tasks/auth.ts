/**
 * Shared admin-gate helper for task API routes. Returns the user_id +
 * farm_id when authorized, or a NextResponse if not.
 *
 * Press Farm OS is single-tenant, so we always resolve to the single farm row.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin as requireAdminSession } from "@/lib/api-auth";

export type AuthOk = { ok: true; userId: string; farmId: string };
export type AuthErr = { ok: false; res: NextResponse };

/**
 * Thin wrapper over the shared `requireAdmin` in src/lib/api-auth.ts (so a
 * change to the admin gate — e.g. the is_active check — reaches the task
 * routes too) that additionally resolves the single farm row.
 */
export async function requireAdmin(): Promise<AuthOk | AuthErr> {
  const supabase = await createClient();
  const auth = await requireAdminSession(supabase);
  if (!auth.ok) return { ok: false, res: auth.response };
  const user = auth.user;

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
