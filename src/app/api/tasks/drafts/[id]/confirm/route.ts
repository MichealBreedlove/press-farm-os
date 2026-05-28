import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import { addDays, todayIso } from "@/lib/tasks/dates";
import type { InboxTaskDraftScheduleItem } from "@/types/database";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/drafts/[id]/confirm
 *
 * Materializes a pending inbox draft into farm_tasks rows. Each schedule
 * item becomes one task with source='inbox-confirmed'. Day offsets are
 * resolved to absolute dates at confirm-time (not at draft-time) so a
 * draft sitting for 3 days still produces sensible future dates.
 *
 * Body (optional): { schedule_override?: InboxTaskDraftScheduleItem[] }
 *   If provided, uses this in place of the draft's stored schedule —
 *   that's how the "Edit" UI submits user-tweaked dates.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const admin = createAdminClient();

  // Load draft.
  const { data: draft, error: draftErr } = await (admin as any)
    .from("inbox_task_drafts")
    .select("*")
    .eq("id", id)
    .single();
  if (draftErr || !draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (draft.status !== "pending" && draft.status !== "edited") {
    return NextResponse.json(
      { error: `Draft already ${draft.status}` },
      { status: 409 },
    );
  }

  const schedule: InboxTaskDraftScheduleItem[] = Array.isArray(body.schedule_override)
    ? body.schedule_override
    : (draft.proposed_schedule as InboxTaskDraftScheduleItem[]);

  if (!Array.isArray(schedule) || schedule.length === 0) {
    return NextResponse.json({ error: "Empty schedule" }, { status: 400 });
  }

  const today = todayIso();
  const rows = schedule.map((s) => ({
    farm_id: auth.farmId,
    title: s.title,
    description: s.description,
    type: s.task_type,
    source: "inbox-confirmed" as const,
    source_ref: {
      inbound_message_id: draft.inbound_message_id,
      suggestion_id: draft.suggestion_id,
      draft_id: draft.id,
      item_id: draft.matched_item_id,
    },
    due_date: addDays(today, s.offset_days_from_today),
    priority: 2 as const,
    status: "open" as const,
    item_id: draft.matched_item_id,
    inbound_message_id: draft.inbound_message_id,
    suggestion_id: draft.suggestion_id,
  }));

  const { data: inserted, error: insErr } = await (admin as any)
    .from("farm_tasks")
    .insert(rows)
    .select("id");
  if (insErr) {
    console.error("[DRAFTS] confirm insert failed", insErr);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  await (admin as any)
    .from("inbox_task_drafts")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    inserted_count: inserted?.length ?? 0,
    task_ids: (inserted ?? []).map((r: any) => r.id),
  });
}
