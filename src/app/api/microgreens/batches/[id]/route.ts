import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: batch } = await (admin as any)
    .from("microgreen_batches")
    .select("*, crop:microgreen_crops(*)")
    .eq("id", params.id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: trays } = await (admin as any)
    .from("microgreen_trays")
    .select("*")
    .eq("batch_id", params.id)
    .order("tray_label");

  return NextResponse.json({ batch, trays: trays ?? [] });
}
