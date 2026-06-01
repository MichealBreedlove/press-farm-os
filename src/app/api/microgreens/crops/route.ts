import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    .insert({ ...body, farm_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crop: data }, { status: 201 });
}
