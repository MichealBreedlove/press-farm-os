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
  const { error } = await (admin as any)
    .from("farm_tasks")
    .update({ status: "cancelled" })
    .eq("farm_id", auth.farmId)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
