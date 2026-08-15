/**
 * Resurrection pass for generated tasks.
 *
 * Both regenerators insert with `upsert(..., { ignoreDuplicates: true })` keyed
 * on the UNIQUE generator_key. That makes re-runs idempotent, but it also means
 * a task that was superseded on an earlier run and is BACK in today's plan can
 * never return to the board: the insert silently no-ops on the conflict and the
 * row stays `superseded` forever, so real work disappears from /admin/tasks.
 *
 * This pass closes that hole — any `superseded` row whose generator_key is in
 * the current run's active set goes back to `open`. Only `superseded` rows are
 * touched: `completed` and `cancelled` are operator decisions and must stick.
 *
 * Run it AFTER the insert and BEFORE the supersession pass — supersession
 * filters on `not in activeKeys`, so it won't undo what this reopens.
 */

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function reopenSupersededTasks(
  admin: AdminClient,
  source: "microgreens-auto" | "recurring-item",
  activeKeys: string[],
): Promise<number> {
  if (activeKeys.length === 0) return 0;

  const { data, error } = await (admin as any)
    .from("farm_tasks")
    .update({ status: "open", superseded_at: null, superseded_reason: null })
    .eq("source", source)
    .eq("status", "superseded")
    .in("generator_key", activeKeys)
    .select("id");

  if (error) {
    console.error(`[TASKS] ${source} reopen failed`, error);
    return 0;
  }
  return data?.length ?? 0;
}
