import { NextResponse } from "next/server";
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crops: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  for (const field of REQUIRED) {
    if (body[field] === undefined || body[field] === null) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farm_id = farms?.[0]?.id;
  if (!farm_id) return NextResponse.json({ error: "No farm configured" }, { status: 500 });

  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .insert({ ...body, farm_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crop: data }, { status: 201 });
}
