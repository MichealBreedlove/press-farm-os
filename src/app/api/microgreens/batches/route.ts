import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { initialStatusForCrop } from "@/lib/microgreens/stages";
import { buildTrayLabel } from "@/lib/microgreens/trayLabel";

export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { crop_id, sow_date, tray_count, seed_lot, notes } = body;
  if (!crop_id || !sow_date || !tray_count || tray_count < 1) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: crop, error: cropErr } = await (admin as any)
    .from("microgreen_crops").select("*").eq("id", crop_id).single();
  if (cropErr || !crop) return NextResponse.json({ error: "Crop not found" }, { status: 404 });

  const sowDateObj = new Date(sow_date + "T00:00:00Z");
  const blackoutEnd = new Date(sowDateObj.getTime() + crop.blackout_days * 24 * 3600 * 1000);
  const harvestDate = new Date(sowDateObj.getTime() + crop.ideal_harvest_day * 24 * 3600 * 1000);
  const status = initialStatusForCrop(crop);

  const { data: batch, error: batchErr } = await (admin as any)
    .from("microgreen_batches")
    .insert({
      crop_id, sow_date, tray_count,
      soak_started_at: status === "soaking" ? new Date().toISOString() : null,
      planned_blackout_end: blackoutEnd.toISOString().slice(0, 10),
      planned_harvest_date: harvestDate.toISOString().slice(0, 10),
      seed_lot: seed_lot ?? null,
      notes: notes ?? null,
    })
    .select().single();
  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });

  const trays = Array.from({ length: tray_count }, (_, i) => ({
    batch_id: batch.id,
    tray_label: buildTrayLabel(crop.name, sowDateObj, i + 1),
    status,
    sow_date,
    blackout_start: status === "blackout" ? sow_date : null,
  }));
  const { error: trayErr } = await (admin as any).from("microgreen_trays").insert(trays);
  if (trayErr) return NextResponse.json({ error: trayErr.message }, { status: 500 });

  return NextResponse.json({ batch, tray_count }, { status: 201 });
}
