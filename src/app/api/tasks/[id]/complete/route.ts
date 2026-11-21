import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTaskWorker } from "@/lib/tasks/auth";
import { isMicrogreenTask } from "@/lib/tasks/assign";
import { scheduleNextStage } from "@/lib/tasks/stage-server";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/complete
 *
 * Marks task completed. If the task is a 'recurring-item' source, the
 * slide_recurring_anchor trigger advances the item's recurring_sow_anchor_date.
 *
 * Admin + Farm Hand (harvester role). A farm hand can only finish a task
 * that is still open; `completed_by` records who did it.
 *
 * Multi-step tasks: finishing a step dates the next one when it is
 * "N days after the previous step" (counted from today, Pacific).
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireTaskWorker();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let notes: string | null = null;
  try {
    const body = await request.json();
    if (body?.completion_notes && typeof body.completion_notes === "string") {
      notes = body.completion_notes.slice(0, 1000);
    }
  } catch {
    // body optional
  }

  const admin = createAdminClient();
  // Microgreen tasks are the farm owner's alone — farm hands can't touch them.
  if (auth.role !== "admin") {
    const { data: existing } = await admin
      .from("farm_tasks")
      .select("source, microgreen_crop_id, microgreen_batch_id")
      .eq("farm_id", auth.farmId)
      .eq("id", id)
      .maybeSingle();
    if (existing && isMicrogreenTask(existing)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  let query = admin
    .from("farm_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: auth.userId,
      completion_notes: notes,
    })
    .eq("farm_id", auth.farmId)
    .eq("id", id);
  if (auth.role !== "admin") query = query.eq("status", "open");
  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    console.error("[TASKS] complete failed", error);
    return NextResponse.json({ error: "Complete failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Task not found or no longer open" }, { status: 409 });
  }
  await scheduleNextStage(admin, data);
  return NextResponse.json({ task: data });
}
