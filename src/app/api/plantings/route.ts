import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/** Keep only the columns a client may set — a stray id / farm_id / created_at
 *  key from a buggy client must not land in the row. */
function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body) out[k] = body[k];
  return out;
}
const PLANTING_FIELDS = ["crop_name","variety","category","item_id","seed_id","location","growing_location","beds","bed_feet","container_type","quantity","quantity_unit","planting_stock","sowing_method","sow_date","transplant_date","harvest_start","harvest_end","termination_date","days_to_maturity","harvest_unit","avg_yield","avg_price","projected_revenue","season","status","notes"] as const;
type RowInsert = Database["public"]["Tables"]["plantings"]["Insert"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const season = url.searchParams.get("season") ?? new Date().getFullYear().toString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plantings")
    .select("*, items(name, image_url, category, unit_type)")
    .eq("season", parseInt(season))
    .order("crop_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plantings")
    .insert(pick(body, PLANTING_FIELDS) as RowInsert)
    .select()
    .single();

  // NOTE: a former block here auto-inserted into `planting_tasks` — that table
  // was dropped in migration 062 (superseded by farm_tasks), so the insert had
  // been silently failing. Removed. Re-add against farm_tasks if planting-driven
  // task generation is wanted again.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
