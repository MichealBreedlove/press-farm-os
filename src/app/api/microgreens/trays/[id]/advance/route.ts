import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nextStatus } from "@/lib/microgreens/stages";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays").select("*").eq("id", params.id).maybeSingle();
  if (!tray) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: batch } = await (admin as any)
    .from("microgreen_batches").select("*").eq("id", tray.batch_id).maybeSingle();
  const { data: crop } = await (admin as any)
    .from("microgreen_crops").select("*").eq("id", batch.crop_id).maybeSingle();

  const newStatus = nextStatus(crop, tray.status);
  // Advancing into 'harvesting' = "this tray is at baby green, ready to cut";
  // it surfaces the crop on the chef/bar order banner. Terminating still has to
  // go through the harvest endpoint so a yield gets logged.
  if (!newStatus || newStatus === "terminated") {
    return NextResponse.json({ error: "Use harvest endpoint instead" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const updates: any = { status: newStatus };
  if (newStatus === "blackout") updates.blackout_start = today;
  if (newStatus === "light") updates.light_start = today;
  if (newStatus === "harvesting") updates.harvesting_start = new Date().toISOString();

  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update(updates)
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tray: data });
}
