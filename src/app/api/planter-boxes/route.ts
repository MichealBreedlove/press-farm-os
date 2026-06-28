import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("planter_boxes")
    .select("*, planter_box_plantings(*)")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ boxes: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Missing field: name" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farm_id = farms?.[0]?.id;
  if (!farm_id) return NextResponse.json({ error: "No farm configured" }, { status: 500 });

  const { data, error } = await (admin as any)
    .from("planter_boxes")
    .insert({
      farm_id,
      name: body.name,
      location: body.location ?? null,
      size: body.size ?? null,
      notes: body.notes ?? null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ box: data }, { status: 201 });
}
