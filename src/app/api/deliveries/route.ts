import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/deliveries?month=2026-04
 * Lists deliveries for a month with items.
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // e.g. "2026-04"

  const admin = createAdminClient();
  let query = (admin as any)
    .from("deliveries")
    .select(`
      id, delivery_date, status, total_value, notes, created_at,
      restaurants ( id, name ),
      delivery_items (
        id, quantity, unit, unit_price, line_total,
        items ( id, name, category )
      )
    `)
    .order("delivery_date", { ascending: false });

  if (month) {
    const start = `${month}-01`;
    const end = new Date(
      parseInt(month.split("-")[0]),
      parseInt(month.split("-")[1]),
      0
    )
      .toISOString()
      .slice(0, 10);
    query = query.gte("delivery_date", start).lte("delivery_date", end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deliveries: data });
}

/**
 * POST /api/deliveries
 * Body: { delivery_date, restaurant_id, notes?, items: [{ item_id, quantity, unit, unit_price }] }
 * Upserts delivery + delivery_items. Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    delivery_date: string;
    restaurant_id: string;
    notes?: string;
    items: { item_id: string; quantity: number; unit: string; unit_price: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { delivery_date, restaurant_id, notes, items } = body;

  if (!delivery_date || !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) {
    return NextResponse.json({ error: "Invalid delivery_date" }, { status: 400 });
  }
  if (!restaurant_id) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  // Validate items
  for (const item of items) {
    if (!item.item_id) return NextResponse.json({ error: "Each item needs item_id" }, { status: 400 });
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      return NextResponse.json({ error: "Invalid unit_price" }, { status: 400 });
    }
  }

  const admin = createAdminClient();

  // Upsert delivery record
  const { data: existing } = await (admin as any)
    .from("deliveries")
    .select("id")
    .eq("delivery_date", delivery_date)
    .eq("restaurant_id", restaurant_id)
    .maybeSingle();

  let deliveryId: string;

  if (existing) {
    deliveryId = existing.id;
    // Delete old items before reinserting
    await (admin as any).from("delivery_items").delete().eq("delivery_id", deliveryId);
    await (admin as any)
      .from("deliveries")
      .update({ notes: notes ?? null, status: "logged" })
      .eq("id", deliveryId);
  } else {
    // Get farm_id from restaurant
    const { data: restaurant } = await (admin as any)
      .from("restaurants")
      .select("farm_id")
      .eq("id", restaurant_id)
      .single();

    const { data: newDelivery, error: deliveryError } = await (admin as any)
      .from("deliveries")
      .insert({
        farm_id: restaurant.farm_id,
        restaurant_id,
        delivery_date,
        notes: notes ?? null,
        status: "logged",
      })
      .select("id")
      .single();

    if (deliveryError) {
      return NextResponse.json({ error: deliveryError.message }, { status: 500 });
    }
    deliveryId = newDelivery.id;
  }

  // Insert delivery items
  const deliveryItems = items.map((item) => ({
    delivery_id: deliveryId,
    item_id: item.item_id,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    line_total: Math.round(item.quantity * item.unit_price * 100) / 100,
  }));

  const { error: itemsError } = await (admin as any)
    .from("delivery_items")
    .insert(deliveryItems);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Fetch updated delivery with total (trigger recalculates total_value)
  const { data: delivery } = await (admin as any)
    .from("deliveries")
    .select("id, total_value, status")
    .eq("id", deliveryId)
    .single();

  return NextResponse.json({ delivery }, { status: existing ? 200 : 201 });
}
