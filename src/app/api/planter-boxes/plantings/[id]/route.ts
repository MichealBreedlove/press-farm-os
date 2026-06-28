import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const f of [
    "item_id", "name", "lifecycle", "planted_date", "end_date",
    "value_amount", "seasonal_months", "status", "notes",
  ]) {
    if (f in body) patch[f] = body[f] === "" ? null : body[f];
  }
  // Keep value_basis consistent if the lifecycle changes.
  if ("lifecycle" in patch) {
    patch.value_basis = patch.lifecycle === "annual" ? "total" : "monthly";
    if (patch.lifecycle !== "perennial_dormant") patch.seasonal_months = [];
  }
  if ("value_amount" in patch) patch.value_amount = Number(patch.value_amount);

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("planter_box_plantings")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ planting: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { error } = await (admin as any).from("planter_box_plantings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
