import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import {
  listTodayTasks,
  listUpcomingTasks,
  listCompletedTasks,
} from "@/lib/tasks/queries";

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
  } = body ?? {};

  if (!title || !due_date) {
    return NextResponse.json({ error: "title and due_date required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
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
    })
    .select("*")
    .single();

  if (error) {
    console.error("[TASKS] insert failed", error);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}
