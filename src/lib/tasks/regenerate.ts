/**
 * Top-level regenerator orchestrator. Called from the nightly Vercel cron
 * and from the manual "Regenerate now" button.
 *
 * Runs each source sequentially. Returns a combined summary so the cron
 * log shows what changed.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { regenerateMicrogreensTasks, type RegenerateResult } from "./regenerate-microgreens";
import { regenerateRecurringItemTasks } from "./regenerate-recurring";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface RegenerateSummary {
  microgreens: RegenerateResult;
  recurring: RegenerateResult;
  total_generated: number;
  total_inserted: number;
  total_reopened: number;
  total_superseded: number;
}

export async function regenerateAllTasks(
  admin: AdminClient,
  farmId: string,
  now: Date = new Date(),
): Promise<RegenerateSummary> {
  const microgreens = await regenerateMicrogreensTasks(admin, farmId, now);
  const recurring = await regenerateRecurringItemTasks(admin, farmId, now);

  return {
    microgreens,
    recurring,
    total_generated: microgreens.generated + recurring.generated,
    total_inserted: microgreens.inserted + recurring.inserted,
    total_reopened: microgreens.reopened + recurring.reopened,
    total_superseded: microgreens.superseded + recurring.superseded,
  };
}

/**
 * Convenience wrapper: resolves the single farm row before kicking off.
 * Press Farm OS is single-tenant (per CLAUDE.md), so we just pick the first.
 */
export async function regenerateAllTasksForDefaultFarm(
  now: Date = new Date(),
): Promise<RegenerateSummary & { farm_id: string | null }> {
  const admin = createAdminClient();
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id ?? null;
  if (!farmId) {
    return {
      farm_id: null,
      microgreens: { generated: 0, inserted: 0, reopened: 0, superseded: 0 },
      recurring: { generated: 0, inserted: 0, reopened: 0, superseded: 0 },
      total_generated: 0,
      total_inserted: 0,
      total_reopened: 0,
      total_superseded: 0,
    };
  }
  const summary = await regenerateAllTasks(admin, farmId, now);
  return { farm_id: farmId, ...summary };
}
