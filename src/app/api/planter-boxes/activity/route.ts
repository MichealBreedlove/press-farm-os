import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { todayPacific } from "@/lib/utils";

export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.box_id) return NextResponse.json({ error: "Missing field: box_id" }, { status: 400 });
  if (!body.note) return NextResponse.json({ error: "Missing field: note" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("planter_box_activity")
    .insert({
      box_id: body.box_id,
      planting_id: body.planting_id || null,
      logged_at: body.logged_at || todayPacific(),
      note: body.note,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await (admin as any).from("planter_box_activity").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
