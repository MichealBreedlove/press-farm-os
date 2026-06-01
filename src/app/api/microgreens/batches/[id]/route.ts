import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

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
