import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import { sanitizeStages } from "@/lib/tasks/stages";
import { appendStages } from "@/lib/tasks/stage-server";
import { resolveAssignees } from "@/lib/tasks/people";
import { isMicrogreenTask } from "@/lib/tasks/assign";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/stages — add one or more next steps after this
 * task's chain (a plain task becomes step 1). Admin only.
 *
 * Body: { stages: [{ title, description?, offset_days? | due_date? }] }
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const stages = sanitizeStages(body?.stages);
  if (stages.length === 0) {
    return NextResponse.json({ error: "Each step needs a title and a when" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: parent } = await (admin as any)
    .from("farm_tasks")
    .select("id, farm_id, type, priority, assigned_to, assignee_ids, location_place, location_quadrant, location_rows, item_id, due_date, stage_group_id, stage_index, source, microgreen_crop_id, microgreen_batch_id")
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const st of stages) {
    if (st.assignee_ids === null) continue;
    const r = await resolveAssignees(admin, st.assignee_ids, { ownerOnly: isMicrogreenTask(parent) });
    if (!r.ok) {
      return NextResponse.json({ error: `A person on "${st.title}" can't be assigned` }, { status: 400 });
    }
  }

  const res = await appendStages(admin, parent, stages);
  if (res.error) {
    console.error("[TASKS] append stages failed", res.error);
    return NextResponse.json({ error: "Couldn't add the steps" }, { status: 500 });
  }
  return NextResponse.json({ stages: res.rows });
}
