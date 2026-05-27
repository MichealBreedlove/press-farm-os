import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { tray_ids, lost_reason } = body;

  if (!Array.isArray(tray_ids) || tray_ids.length === 0) {
    return NextResponse.json({ error: "tray_ids must be a non-empty array" }, { status: 400 });
  }
  if (!lost_reason || typeof lost_reason !== "string") {
    return NextResponse.json({ error: "lost_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update({
      status: "lost",
      lost_reason,
      terminated_at: new Date().toISOString(),
    })
    .in("id", tray_ids)
    .in("status", ["soaking", "blackout", "light", "harvesting"])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
