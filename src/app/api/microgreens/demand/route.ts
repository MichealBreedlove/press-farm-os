import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_demand")
    .select("*, crop:microgreen_crops(id,name), restaurant:restaurants(id,name)")
    .order("crop_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demand: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.crop_id) return NextResponse.json({ error: "Missing crop_id" }, { status: 400 });
  if (body.day_of_week == null || body.day_of_week < 0 || body.day_of_week > 6)
    return NextResponse.json({ error: "day_of_week must be 0-6" }, { status: 400 });

  // Migration 047: new shape uses target_quantity + target_unit. The legacy
  // target_oz path is still accepted for back-compat but new clients should
  // send quantity + unit.
  const hasNewShape =
    typeof body.target_quantity === "number" &&
    body.target_quantity > 0 &&
    typeof body.target_unit === "string" &&
    ["lg", "sm", "ea", "gb"].includes(body.target_unit);

  if (!hasNewShape) {
    if (!body.target_oz || body.target_oz <= 0) {
      return NextResponse.json(
        { error: "Either (target_quantity + target_unit) or target_oz must be set" },
        { status: 400 },
      );
    }
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_demand")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demand: data }, { status: 201 });
}
