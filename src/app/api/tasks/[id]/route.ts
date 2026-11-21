import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import { sanitizeTaskPhotoUrls } from "@/lib/tasks/photos";
import { resolveAssignees } from "@/lib/tasks/people";
import { isMicrogreenTask } from "@/lib/tasks/assign";
import { detachAndRenumber, dueFromPreviousStep } from "@/lib/tasks/stage-server";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("farm_tasks")
    .select("*")
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ task: data });
}

/**
 * PATCH /api/tasks/[id] — edit a task. Only editable fields are allowed
 * through (no monkeying with generator_key, source, etc).
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

  const updates: Record<string, unknown> = {};
  for (const k of [
    "title",
    "description",
    "type",
    "due_date",
    "due_time",
    "priority",
    "completion_notes",
    "item_id",
    "microgreen_crop_id",
    "title_es",
    "description_es",
  ]) {
    if (k in body) updates[k] = body[k];
  }
  if ("photo_urls" in body) updates.photo_urls = sanitizeTaskPhotoUrls(body.photo_urls);
  const admin = createAdminClient();

  // A step's timing: "N days after the previous step" (re-dated from the
  // previous step's finish / due date) or a fixed date (offset cleared).
  if ("stage_offset_days" in body) {
    const raw = body.stage_offset_days;
    const off = raw === null || raw === "" ? null : Number(raw);
    if (off !== null && (!Number.isFinite(off) || off < 0 || off > 365)) {
      return NextResponse.json({ error: "Days must be between 0 and 365" }, { status: 400 });
    }
    updates.stage_offset_days = off === null ? null : Math.round(off);
    if (off !== null && !("due_date" in body)) {
      const { data: me } = await (admin as any)
        .from("farm_tasks")
        .select("stage_group_id, stage_index")
        .eq("farm_id", auth.farmId)
        .eq("id", id)
        .maybeSingle();
      if (me) updates.due_date = await dueFromPreviousStep(admin, me, Math.round(off));
    }
  } else if ("due_date" in body) {
    // Picking a date by hand makes it a fixed-date step.
    updates.stage_offset_days = null;
  }
  if ("assignee_ids" in body || "assigned_to" in body) {
    const { data: current } = await admin
      .from("farm_tasks")
      .select("source, microgreen_crop_id, microgreen_batch_id")
      .eq("farm_id", auth.farmId)
      .eq("id", id)
      .maybeSingle();
    const micro = current
      ? isMicrogreenTask({
          ...current,
          microgreen_crop_id:
            "microgreen_crop_id" in body ? body.microgreen_crop_id : current.microgreen_crop_id,
        })
      : false;
    const assignees = await resolveAssignees(
      admin,
      "assignee_ids" in body ? body.assignee_ids : body.assigned_to,
      { ownerOnly: micro },
    );
    if (!assignees.ok) {
      return NextResponse.json(
        { error: micro ? "Microgreen tasks can't be assigned to farm hands" : "That person can't be assigned this task" },
        { status: 400 },
      );
    }
    updates.assignee_ids = assignees.ids;
    updates.assigned_to = assignees.ids[0] ?? null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("farm_tasks")
    .update(updates)
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[TASKS] patch failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}

/**
 * DELETE /api/tasks/[id] — soft-delete via status='cancelled'. Generator
 * keys live forever so cron supersession logic stays consistent. A step of
 * a multi-step task leaves its chain and the remaining steps are renumbered.
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { error } = await admin
    .from("farm_tasks")
    .update({ status: "cancelled" })
    .eq("farm_id", auth.farmId)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
  await detachAndRenumber(admin, id);
  return NextResponse.json({ ok: true });
}
