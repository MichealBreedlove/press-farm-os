import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTaskWorker } from "@/lib/tasks/auth";
import { isOwnTask } from "@/lib/tasks/own";
import { translateAndStoreTask } from "@/lib/tasks/translate";

// Translation is one short model call, but give it room on a cold start.
export const maxDuration = 60;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/translate
 *
 * Fills `title_es` / `description_es` so the crew reads the task in Spanish
 * on the Farm Hand portal. The task forms fire this (without waiting) right
 * after a create or an English-text edit, so saving stays instant.
 * Best-effort: with no ANTHROPIC_API_KEY the task simply stays English.
 *
 * Admin for any task; the Head Farm Hand only for a task he added for
 * himself (POST /api/tasks/mine).
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  const auth = await requireTaskWorker();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  if (auth.role !== "admin") {
    const { data: task } = await createAdminClient()
      .from("farm_tasks")
      .select("source, assignee_ids")
      .eq("id", id)
      .maybeSingle();
    if (auth.role !== "head_farmhand" || !task || !isOwnTask(task, auth.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  await translateAndStoreTask(id);
  return NextResponse.json({ ok: true });
}
