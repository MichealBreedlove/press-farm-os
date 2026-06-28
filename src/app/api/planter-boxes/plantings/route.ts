import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const LIFECYCLES = ["annual", "perennial_evergreen", "perennial_dormant"] as const;

export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await req.json();

  if (!body.box_id) return NextResponse.json({ error: "Missing field: box_id" }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: "Missing field: name" }, { status: 400 });
  if (!LIFECYCLES.includes(body.lifecycle)) {
    return NextResponse.json({ error: "Invalid lifecycle" }, { status: 400 });
  }
  if (!body.planted_date) {
    return NextResponse.json({ error: "Missing field: planted_date" }, { status: 400 });
  }
  const value = Number(body.value_amount);
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "Invalid value_amount" }, { status: 400 });
  }

  // value_basis is derived from lifecycle: annual = a total over its window,
  // perennials = a monthly rate.
  const value_basis = body.lifecycle === "annual" ? "total" : "monthly";
  const seasonal_months: number[] =
    body.lifecycle === "perennial_dormant" ? (body.seasonal_months ?? []) : [];

  if (body.lifecycle === "annual" && !body.end_date) {
    return NextResponse.json({ error: "Annual plantings need an end date" }, { status: 400 });
  }
  if (body.lifecycle === "perennial_dormant" && seasonal_months.length === 0) {
    return NextResponse.json(
      { error: "Dormant perennials need at least one seasonal month" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("planter_box_plantings")
    .insert({
      box_id: body.box_id,
      item_id: body.item_id || null,
      name: body.name,
      lifecycle: body.lifecycle,
      planted_date: body.planted_date,
      end_date: body.end_date || null,
      value_amount: value,
      value_basis,
      seasonal_months,
      status: body.status ?? "active",
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ planting: data }, { status: 201 });
}
