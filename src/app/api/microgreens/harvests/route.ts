import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_harvests")
    .select("*, tray:microgreen_trays(id, tray_label, batch_id, batch:microgreen_batches(crop:microgreen_crops(name)))")
    .order("harvested_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ harvests: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // quantity + unit (lg/sm/ea) is the current model; yield_oz accepted as a
  // legacy alias. The DB column is still named yield_oz but holds the quantity.
  const { tray_id, delivery_id, restaurant_id, notes } = body;
  const quantity = body.quantity ?? body.yield_oz;
  const unit = body.unit ?? "oz";
  if (!tray_id || quantity == null || quantity < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays").select("*").eq("id", tray_id).maybeSingle();
  if (!tray) return NextResponse.json({ error: "Tray not found" }, { status: 404 });

  const { data: batch } = await (admin as any)
    .from("microgreen_batches").select("crop_id").eq("id", tray.batch_id).maybeSingle();
  const { data: crop } = await (admin as any)
    .from("microgreen_crops").select("is_continuous_harvest").eq("id", batch.crop_id).maybeSingle();

  const now = new Date().toISOString();
  const { data: harvest, error: hErr } = await (admin as any)
    .from("microgreen_harvests")
    .insert({
      tray_id, yield_oz: quantity, unit,
      delivery_id: delivery_id ?? null,
      restaurant_id: restaurant_id ?? null,
      notes: notes ?? null,
      harvested_at: now,
    })
    .select().single();
  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

  const update: any = {};
  if (tray.status === "light" || tray.status === "blackout") {
    update.status = "harvesting";
    update.harvesting_start = now;
  }
  if (!crop.is_continuous_harvest) {
    update.status = "terminated";
    update.terminated_at = now;
  }
  if (Object.keys(update).length) {
    await (admin as any).from("microgreen_trays").update(update).eq("id", tray_id);
  }

  return NextResponse.json({ harvest }, { status: 201 });
}
