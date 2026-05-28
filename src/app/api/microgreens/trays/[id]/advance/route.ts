import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nextStatus } from "@/lib/microgreens/stages";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays").select("*").eq("id", params.id).maybeSingle();
  if (!tray) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: batch } = await (admin as any)
    .from("microgreen_batches").select("*").eq("id", tray.batch_id).maybeSingle();
  const { data: crop } = await (admin as any)
    .from("microgreen_crops").select("*").eq("id", batch.crop_id).maybeSingle();

  const newStatus = nextStatus(crop, tray.status);
  if (!newStatus || newStatus === "harvesting" || newStatus === "terminated") {
    return NextResponse.json({ error: "Use harvest endpoint instead" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const updates: any = { status: newStatus };
  if (newStatus === "blackout") updates.blackout_start = today;
  if (newStatus === "light") updates.light_start = today;

  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update(updates)
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tray: data });
}
