import { NextResponse } from "next/server";
import { regenerateAllTasksForDefaultFarm } from "@/lib/tasks/regenerate";
import { requireCronSecret } from "@/lib/api-auth";

export const maxDuration = 60;

/**
 * GET /api/cron/tasks-regenerate
 *
 * Vercel cron entry. Runs nightly per vercel.json. Re-runs the microgreens
 * sow plan + per-item recurring generator, upserting new tasks and
 * superseding stale ones. Idempotent — running twice is a no-op.
 *
 * Auth: Bearer ${CRON_SECRET}. Same pattern as receiver-notify route.
 * Dev/local with unset CRON_SECRET allows through so curl tests work.
 */
export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const summary = await regenerateAllTasksForDefaultFarm();
  console.log("[CRON] tasks-regenerate", summary);
  return NextResponse.json({ ok: true, summary });
}
