import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

/** Keep only the columns a client may set — a stray id / farm_id / created_at
 *  key from a buggy client must not land in the row. */
function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body) out[k] = body[k];
  return out;
}
const CROP_FIELDS = ["name","variety","item_id","is_active","tray_size","growing_medium","preferred_medium","seed_density_g_per_tray","presoak_hours","presprout_hours","bury_seed","keep_in_blackout","weight_during_blackout","blackout_days","harvest_min_days","harvest_max_days","ideal_harvest_day","harvest_stage","is_continuous_harvest","productive_life_days","expected_yield_oz_per_tray","yield_per_tray","value_per_tray","notes"] as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ crop: data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .update(pick(body, CROP_FIELDS))
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crop: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { error } = await (admin as any)
    .from("microgreen_crops")
    .update({ is_active: false })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
