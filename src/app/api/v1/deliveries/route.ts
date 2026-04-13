import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/deliveries — List deliveries
 * Query: ?month=2026-03&date=2026-03-14&restaurant=press&limit=50
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const date = url.searchParams.get("date");
  const limit = parseInt(url.searchParams.get("limit") ?? "100");

  const admin = createAdminClient();
  let query = (admin as any).from("deliveries")
    .select("*, restaurants(name), delivery_items(*, items(name, category, unit_type))")
    .order("delivery_date", { ascending: false })
    .limit(limit);

  if (date) query = query.eq("delivery_date", date);
  if (month) {
    query = query.gte("delivery_date", `${month}-01`);
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    query = query.lte("delivery_date", `${month}-${String(lastDay).padStart(2, "0")}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

/**
 * POST /api/v1/deliveries — Log a delivery
 * Body: { delivery_date, restaurant_id, notes?, items: [{ item_id, quantity, unit, unit_price }] }
 */
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const admin = createAdminClient();

  const totalValue = (body.items ?? []).reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0);

  const { data: delivery, error: delErr } = await (admin as any).from("deliveries").insert({
    delivery_date: body.delivery_date,
    restaurant_id: body.restaurant_id,
    status: "logged",
    total_value: Math.round(totalValue * 100) / 100,
    notes: body.notes ?? null,
  }).select().single();

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (body.items?.length) {
    const { error: itemErr } = await (admin as any).from("delivery_items").insert(
      body.items.map((i: any) => ({ delivery_id: delivery.id, item_id: i.item_id, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price }))
    );
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: delivery }, { status: 201 });
}

/**
 * DELETE /api/v1/deliveries — Delete a delivery
 * Body: { id }
 */
export async function DELETE(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await request.json();
  const admin = createAdminClient();
  await (admin as any).from("delivery_items").delete().eq("delivery_id", id);
  const { error } = await (admin as any).from("deliveries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
