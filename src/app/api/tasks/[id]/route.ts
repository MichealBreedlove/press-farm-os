import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("farm_tasks")
    .select("*")
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ task: data });
}

/**
 * PATCH /api/tasks/[id] — edit a task. Only editable fields are allowed
 * through (no monkeying with generator_key, source, etc).
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const k of [
    "title",
    "description",
    "type",
    "due_date",
    "due_time",
    "priority",
    "completion_notes",
    "item_id",
    "microgreen_crop_id",
  ]) {
    if (k in body) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("farm_tasks")
    .update(updates)
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[TASKS] patch failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}

/**
 * DELETE /api/tasks/[id] — soft-delete via status='cancelled'. Generator
 * keys live forever so cron supersession logic stays consistent.
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { error } = await admin
    .from("farm_tasks")
    .update({ status: "cancelled" })
    .eq("farm_id", auth.farmId)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
