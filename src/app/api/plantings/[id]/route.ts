import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Keep only the columns a client may set — a stray id / farm_id / created_at
 *  key from a buggy client must not land in the row. */
function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body) out[k] = body[k];
  return out;
}
const PLANTING_FIELDS = ["crop_name","variety","category","item_id","seed_id","location","growing_location","beds","bed_feet","container_type","quantity","quantity_unit","planting_stock","sowing_method","sow_date","transplant_date","harvest_start","harvest_end","termination_date","days_to_maturity","harvest_unit","avg_yield","avg_price","projected_revenue","season","status","notes"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plantings")
    .update(pick(body, PLANTING_FIELDS))
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { error } = await admin.from("plantings").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
