import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";

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
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("farm_tasks")
    .update({
      status: "open",
      completed_at: null,
      completion_notes: null,
      superseded_at: null,
      superseded_reason: null,
      snoozed_until: null,
    })
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[TASKS] reopen failed", error);
    return NextResponse.json({ error: "Reopen failed" }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}
