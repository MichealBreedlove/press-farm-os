import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import type { InboxTaskDraftScheduleItem } from "@/types/database";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const VALID_TYPES = new Set(["sow", "transplant", "harvest", "maintenance"]);

/**
 * PATCH /api/tasks/drafts/[id]/edit
 *
 * Updates the proposed_schedule on a draft without confirming. Use the
 * confirm endpoint to actually create tasks. Marks status='edited' so the
 * UI can show "you edited this" hint.
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const schedule = body.proposed_schedule;
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return NextResponse.json({ error: "proposed_schedule must be a non-empty array" }, { status: 400 });
  }

  // Light validation
  for (const item of schedule as InboxTaskDraftScheduleItem[]) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Schedule item must be an object" }, { status: 400 });
    }
    if (!VALID_TYPES.has(item.task_type)) {
      return NextResponse.json({ error: `Invalid task_type: ${item.task_type}` }, { status: 400 });
    }
    if (typeof item.offset_days_from_today !== "number") {
      return NextResponse.json({ error: "offset_days_from_today must be number" }, { status: 400 });
    }
    if (!item.title || typeof item.title !== "string") {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("inbox_task_drafts")
    .update({ proposed_schedule: schedule, status: "edited" })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ draft: data });
}
