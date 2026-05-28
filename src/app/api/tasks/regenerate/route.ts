import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/tasks/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { regenerateAllTasks } from "@/lib/tasks/regenerate";

/**
 * POST /api/tasks/regenerate
 *
 * Manual trigger for the same orchestrator the nightly cron runs. Useful
 * after editing microgreen demand or per-item recurrence and wanting the
 * task list to reflect the change immediately.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const admin = createAdminClient();
  const summary = await regenerateAllTasks(admin, auth.farmId);
  return NextResponse.json({ summary });
}
