import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import {
  listTodayTasks,
  listUpcomingTasks,
  listCompletedTasks,
} from "@/lib/tasks/queries";
import { sanitizeTaskPhotoUrls } from "@/lib/tasks/photos";
import { resolveAssignees } from "@/lib/tasks/people";
import { isMicrogreenTask } from "@/lib/tasks/assign";
import { sanitizeStages } from "@/lib/tasks/stages";
import { appendStages } from "@/lib/tasks/stage-server";

/**
 * GET /api/tasks?view=today|upcoming|done
 *
 * Default view: today. Returns plain farm_tasks rows.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const view = (searchParams.get("view") ?? "today") as "today" | "upcoming" | "done";
  const admin = createAdminClient();

  const tasks =
    view === "today"
      ? await listTodayTasks(admin, auth.farmId)
      : view === "upcoming"
        ? await listUpcomingTasks(admin, auth.farmId)
        : await listCompletedTasks(admin, auth.farmId);

  return NextResponse.json({ tasks });
}

/**
 * POST /api/tasks — create a manual task.
 *
 * `photo_urls` are pictures uploaded through /api/upload/sign (folder
 * "tasks"). Spanish text is filled in afterwards by
 * POST /api/tasks/[id]/translate, which the form fires once the task exists.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    title,
    description = null,
    type = "custom",
    due_date,
    due_time = null,
    priority = 2,
    item_id = null,
    microgreen_crop_id = null,
    photo_urls,
    assigned_to,
    assignee_ids,
    stages,
  } = body ?? {};

  if (!title || !due_date) {
    return NextResponse.json({ error: "title and due_date required" }, { status: 400 });
  }

  const admin = createAdminClient();
  // One or more people (`assignee_ids`); the older single `assigned_to` still works.
  const microTask = isMicrogreenTask({ source: "manual", microgreen_crop_id });
  const assignees = await resolveAssignees(admin, assignee_ids ?? assigned_to, { ownerOnly: microTask });
  if (!assignees.ok) {
    return NextResponse.json({ error: "That person can't be assigned this task" }, { status: 400 });
  }
  // Each later step's people must be valid too.
  const next = sanitizeStages(stages);
  for (const st of next) {
    if (st.assignee_ids === null) continue;
    const r = await resolveAssignees(admin, st.assignee_ids, { ownerOnly: microTask });
    if (!r.ok) {
      return NextResponse.json({ error: `A person on "${st.title}" can't be assigned` }, { status: 400 });
    }
  }
  const { data, error } = await admin
    .from("farm_tasks")
    .insert({
      farm_id: auth.farmId,
      title: String(title).slice(0, 500),
      description,
      type,
      source: "manual",
      due_date,
      due_time,
      priority,
      item_id,
      microgreen_crop_id,
      photo_urls: sanitizeTaskPhotoUrls(photo_urls),
      assignee_ids: assignees.ids,
      assigned_to: assignees.ids[0] ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[TASKS] insert failed", error);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Follow-on steps ("then 21 days later, transplant to the field").
  let stageRows: any[] = [];
  if (next.length > 0) {
    const res = await appendStages(admin, data as any, next);
    if (res.error) {
      console.error("[TASKS] stage insert failed", res.error);
      return NextResponse.json({ error: "Task saved, but its later steps failed — add them again" }, { status: 500 });
    }
    stageRows = res.rows;
  }
  return NextResponse.json({ task: data, stages: stageRows });
}
