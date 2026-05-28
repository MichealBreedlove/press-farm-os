import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/complete
 *
 * Marks task completed. If the task is a 'recurring-item' source, the
 * slide_recurring_anchor trigger advances the item's recurring_sow_anchor_date.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
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
  const { data, error } = await (admin as any)
    .from("farm_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completion_notes: notes,
    })
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[TASKS] complete failed", error);
    return NextResponse.json({ error: "Complete failed" }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}
