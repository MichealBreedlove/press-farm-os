import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/tasks/auth";
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
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  await translateAndStoreTask(id);
  return NextResponse.json({ ok: true });
}
