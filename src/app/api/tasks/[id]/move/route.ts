import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import { moveStage } from "@/lib/tasks/stage-server";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** POST /api/tasks/[id]/move — { direction: "up" | "down" } within its chain. Admin only. */
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
  if (body?.direction !== "up" && body?.direction !== "down") {
    return NextResponse.json({ error: "direction must be up or down" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: own } = await admin.from("farm_tasks").select("id").eq("farm_id", auth.farmId).eq("id", id).maybeSingle();
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const moved = await moveStage(admin, id, body.direction);
  if (!moved) return NextResponse.json({ error: "Can't move that way" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
