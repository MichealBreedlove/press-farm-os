import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return null;
  return user;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { tray_ids } = body;
  const lost_reason = typeof body.lost_reason === "string" ? body.lost_reason.trim() : "";

  if (!Array.isArray(tray_ids) || tray_ids.length === 0) {
    return NextResponse.json({ error: "tray_ids must be a non-empty array" }, { status: 400 });
  }
  if (!lost_reason) {
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
