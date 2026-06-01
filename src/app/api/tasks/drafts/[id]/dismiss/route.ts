import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { error } = await admin
    .from("inbox_task_drafts")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Dismiss failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
