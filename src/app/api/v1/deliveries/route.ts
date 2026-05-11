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

  // Validate everything up-front — this is a public endpoint behind an API key
  // and the values land directly in financial tables, so any non-finite or
  // negative number would corrupt revenue rollups.
  const deliveryDate = typeof body.delivery_date === "string" ? body.delivery_date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return NextResponse.json({ error: "delivery_date must be YYYY-MM-DD" }, { status: 400 });
  }
  const restaurantId = typeof body.restaurant_id === "string" ? body.restaurant_id.trim() : "";
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const cleanItems: { item_id: string; quantity: number; unit: string; unit_price: number }[] = [];
  for (const [i, raw] of rawItems.entries()) {
    const itemId = typeof raw?.item_id === "string" ? raw.item_id.trim() : "";
    const quantity = Number(raw?.quantity);
    const unit = typeof raw?.unit === "string" ? raw.unit.trim() : "";
    const unitPrice = Number(raw?.unit_price);
    if (!itemId) return NextResponse.json({ error: `item ${i + 1}: item_id required` }, { status: 400 });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: `item ${i + 1}: quantity must be a positive number` }, { status: 400 });
    }
    if (!unit) return NextResponse.json({ error: `item ${i + 1}: unit required` }, { status: 400 });
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: `item ${i + 1}: unit_price must be a non-negative finite number` }, { status: 400 });
    }
    cleanItems.push({ item_id: itemId, quantity, unit, unit_price: unitPrice });
  }

  const admin = createAdminClient();

  // Verify the restaurant exists — otherwise a bad ID would still
  // succeed an FK-less insert (deliveries.restaurant_id has no FK on
  // some schemas) and orphan the row.
  const { data: restRow } = await (admin as any)
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!restRow) {
    return NextResponse.json({ error: "restaurant_id does not exist" }, { status: 400 });
  }

  const totalValue = cleanItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const { data: delivery, error: delErr } = await (admin as any).from("deliveries").insert({
    delivery_date: deliveryDate,
    restaurant_id: restaurantId,
    status: "logged",
    total_value: Math.round(totalValue * 100) / 100,
    notes: typeof body.notes === "string" ? body.notes : null,
  }).select().single();

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (cleanItems.length) {
    const { error: itemErr } = await (admin as any).from("delivery_items").insert(
      cleanItems.map((i) => ({ delivery_id: delivery.id, ...i })),
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
