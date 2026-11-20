import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTaskWorker } from "@/lib/tasks/auth";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/reopen
 *
 * Reverses a completion. Clears completed_at + completion_notes and
 * flips status back to 'open'. Works on completed, superseded, snoozed,
 * or cancelled tasks.
 *
 * Important: does NOT walk back the recurring_sow_anchor_date if the
 * task was a recurring-item source. The slide-forward trigger only
 * fires on transition INTO completed — reopening leaves the anchor
 * where it landed. If you reopened because the task was completed by
 * accident, manually edit the item's anchor in /admin/items/[id].
 *
 * Admin + Farm Hand. A farm hand can only undo a COMPLETED task (their
 * "oops, wrong one" button) — cancelled / superseded tasks stay admin-only.
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  const auth = await requireTaskWorker();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  let query = admin
    .from("farm_tasks")
    .update({
      status: "open",
      completed_at: null,
      completed_by: null,
      completion_notes: null,
      superseded_at: null,
      superseded_reason: null,
      snoozed_until: null,
    })
    .eq("farm_id", auth.farmId)
    .eq("id", id);
  if (auth.role !== "admin") query = query.eq("status", "completed");
  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    console.error("[TASKS] reopen failed", error);
    return NextResponse.json({ error: "Reopen failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Task not found or not completed" }, { status: 409 });
  }
  return NextResponse.json({ task: data });
}
