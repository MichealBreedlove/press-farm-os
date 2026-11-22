import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTaskWorker } from "@/lib/tasks/auth";
import { buildOwnTask } from "@/lib/tasks/own";
import { todayPacific } from "@/lib/utils";

/**
 * POST /api/tasks/mine — the Head Farm Hand adds a task for HIMSELF.
 *
 * Body: `{ title, when?: "today" | "tomorrow" }`. The task always goes to
 * the signed-in person — any assignee in the body is ignored — so this can
 * never put work on someone else's list. Everything else about creating
 * tasks (other people, steps, photos, places) stays on the admin form.
 */
export async function POST(request: Request) {
  const auth = await requireTaskWorker();
  if (!auth.ok) return auth.res;
  if (auth.role === "harvester") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const built = buildOwnTask(body, auth.userId, todayPacific());
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("farm_tasks")
    .insert({ farm_id: auth.farmId, ...built.row })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[TASKS] own-task insert failed", error);
    return NextResponse.json({ error: "Could not save — try again." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
