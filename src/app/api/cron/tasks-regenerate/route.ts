import { NextResponse } from "next/server";
import { regenerateAllTasksForDefaultFarm } from "@/lib/tasks/regenerate";

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
  const expected = process.env.CRON_SECRET;
  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (!expected) {
    if (isProd) {
      return NextResponse.json(
        { error: "Misconfigured: CRON_SECRET not set in production" },
        { status: 500 },
      );
    }
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const summary = await regenerateAllTasksForDefaultFarm();
  console.log("[CRON] tasks-regenerate", summary);
  return NextResponse.json({ ok: true, summary });
}
