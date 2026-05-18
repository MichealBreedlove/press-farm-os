import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { lost, lost_reason } = body;
  const status = lost ? "lost" : "terminated";
  if (lost && !lost_reason) {
    return NextResponse.json({ error: "lost_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update({
      status,
      terminated_at: new Date().toISOString(),
      lost_reason: lost ? lost_reason : null,
    })
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tray: data });
}
