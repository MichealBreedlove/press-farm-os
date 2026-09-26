import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { comparePlanterBoxes } from "@/lib/utils";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("planter_boxes")
    .select("*, planter_box_plantings(*)")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const boxes = (data ?? []).sort(comparePlanterBoxes);
  return NextResponse.json({ boxes });
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

  // New boxes go to the end of the walking order (sort_order drives the list page).
  let sort_order: number | null = typeof body.sort_order === "number" ? body.sort_order : null;
  if (sort_order === null) {
    const { data: last } = await (admin as any)
      .from("planter_boxes")
      .select("sort_order")
      .not("sort_order", "is", null)
      .order("sort_order", { ascending: false })
      .limit(1);
    sort_order = (last?.[0]?.sort_order ?? 0) + 1;
  }

  const { data, error } = await (admin as any)
    .from("planter_boxes")
    .insert({
      farm_id,
      name: body.name,
      location: body.location ?? null,
      size: body.size ?? null,
      notes: body.notes ?? null,
      is_active: body.is_active ?? true,
      sort_order,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ box: data }, { status: 201 });
}
