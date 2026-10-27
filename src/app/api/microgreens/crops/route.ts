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
const CROP_FIELDS = ["name","variety","item_id","is_active","tray_size","growing_medium","preferred_medium","seed_density_g_per_tray","presoak_hours","presprout_hours","bury_seed","keep_in_blackout","weight_during_blackout","blackout_days","harvest_min_days","harvest_max_days","ideal_harvest_day","harvest_stage","is_continuous_harvest","productive_life_days","expected_yield_oz_per_tray","yield_per_tray","value_per_tray","notes"] as const;
type RowInsert = Database["public"]["Tables"]["microgreen_crops"]["Insert"];

// expected_yield_oz_per_tray dropped from required: migration 047 moved yield
// to per-unit yield_per_tray jsonb. The oz field stays on the row for legacy
// reports but isn't enforced on create.
const REQUIRED = [
  "name", "seed_density_g_per_tray", "blackout_days",
  "ideal_harvest_day",
];

export async function GET(_req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("microgreen_crops")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crops: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  for (const field of REQUIRED) {
    if (body[field] === undefined || body[field] === null) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farm_id = farms?.[0]?.id;
  if (!farm_id) return NextResponse.json({ error: "No farm configured" }, { status: 500 });

  const { data, error } = await admin
    .from("microgreen_crops")
    .insert({ ...pick(body, CROP_FIELDS), farm_id } as RowInsert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crop: data }, { status: 201 });
}
