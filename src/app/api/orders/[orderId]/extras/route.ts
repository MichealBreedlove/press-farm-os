import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { UNIT_TYPES } from "@/lib/constants";

const VALID_UNITS = new Set(UNIT_TYPES.map((u) => u.value));

/**
 * POST /api/orders/[orderId]/extras
 * Body: { item_id: string, quantity: number, unit: string, unit_price?: number }
 *
 * Adds an "extra" delivery line item — produce that wasn't on the chef's
 * original order but is being delivered anyway. The line goes into the
 * delivery_items table (not order_items); the receiver dashboard + email
 * surfaces it as an EXTRA status pill.
 *
 * The orderId tells us which (delivery_date, restaurant_id) pair to attach
 * the delivery_item to. If a deliveries row doesn't exist for that pair,
 * we create one in 'logged' status.
 *
 * Admin only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  let body: { item_id: string; quantity: number; unit: string; unit_price?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { item_id, quantity, unit, unit_price } = body;
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "quantity must be > 0" }, { status: 400 });
  }
  if (!unit || !VALID_UNITS.has(unit as any)) {
    return NextResponse.json({ error: "Invalid unit" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Resolve the (delivery_date, restaurant_id) from the order
  const { data: order, error: orderErr } = await (admin as any)
    .from("orders")
    .select("id, delivery_date, restaurant_id")
    .eq("id", orderId)
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // 2. Resolve a price — prefer the item's per-unit price, then default_price
  const { data: item } = await (admin as any)
    .from("items")
    .select("id, unit_prices, default_price")
    .eq("id", item_id)
    .single();
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  let resolvedPrice = unit_price;
  if (resolvedPrice == null) {
    const map = item.unit_prices ?? {};
    if (typeof map[unit] === "number") resolvedPrice = map[unit];
    else if (item.default_price != null) resolvedPrice = Number(item.default_price);
    else resolvedPrice = 0;
  }

  // 3. Find or create the delivery row for this date+restaurant
  const { data: existingDelivery } = await (admin as any)
    .from("deliveries")
    .select("id")
    .eq("delivery_date", order.delivery_date)
    .eq("restaurant_id", order.restaurant_id)
    .maybeSingle();

  let deliveryId: string;
  if (existingDelivery) {
    deliveryId = existingDelivery.id;
  } else {
    const { data: newDelivery, error: insErr } = await (admin as any)
      .from("deliveries")
      .insert({
        delivery_date: order.delivery_date,
        restaurant_id: order.restaurant_id,
        status: "logged",
      })
      .select("id")
      .single();
    if (insErr || !newDelivery) {
      return NextResponse.json({ error: "Failed to create delivery row" }, { status: 500 });
    }
    deliveryId = newDelivery.id;
  }

  // 4. Insert the delivery_item — total_value is auto-recomputed via the
  //    update_delivery_total trigger, line_total is a generated column
  const { data: line, error: lineErr } = await (admin as any)
    .from("delivery_items")
    .insert({
      delivery_id: deliveryId,
      item_id,
      quantity,
      unit,
      unit_price: resolvedPrice,
    })
    .select("id, quantity, unit, unit_price, line_total")
    .single();

  if (lineErr || !line) {
    return NextResponse.json({ error: lineErr?.message ?? "Failed to add extra" }, { status: 500 });
  }

  return NextResponse.json({ delivery_id: deliveryId, line });
}

/**
 * DELETE /api/orders/[orderId]/extras?lineId=...
 * Removes a previously-added extra delivery_item. Useful if admin
 * adds the wrong item or wrong quantity during pick-and-pack.
 *
 * Admin only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const lineId = new URL(request.url).searchParams.get("lineId");
  if (!orderId || !lineId) {
    return NextResponse.json({ error: "Missing orderId or lineId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the line belongs to a delivery that matches this order's date+restaurant
  // (defensive check — keeps admins from accidentally deleting cross-tenant lines).
  const { data: order } = await (admin as any)
    .from("orders").select("delivery_date, restaurant_id").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: line } = await (admin as any)
    .from("delivery_items")
    .select("id, delivery:deliveries(delivery_date, restaurant_id)")
    .eq("id", lineId)
    .single();
  if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });

  const d = (line as any).delivery;
  if (!d || d.delivery_date !== order.delivery_date || d.restaurant_id !== order.restaurant_id) {
    return NextResponse.json({ error: "Line does not belong to this order's delivery" }, { status: 403 });
  }

  const { error } = await (admin as any).from("delivery_items").delete().eq("id", lineId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
