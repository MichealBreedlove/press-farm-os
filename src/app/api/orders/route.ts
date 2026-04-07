import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/orders — Submit or update an order
 *
 * Body: { restaurant_id, delivery_date, items: [{availability_item_id, quantity, unit_price}], freeform_notes }
 *
 * Upserts order and order_items (one order per restaurant per delivery date).
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    restaurant_id: string;
    delivery_date: string;
    items: { availability_item_id: string; quantity: number; unit_price?: number | null }[];
    freeform_notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { restaurant_id, delivery_date, items, freeform_notes } = body;

  if (!restaurant_id || !delivery_date || !Array.isArray(items)) {
    return NextResponse.json(
      { error: "Missing required fields: restaurant_id, delivery_date, items" },
      { status: 400 }
    );
  }

  // Fix 2: Validate each item has a valid structure
  const invalidItems = items.filter((item: any) =>
    !item.availability_item_id ||
    typeof item.quantity !== 'number' ||
    item.quantity < 0 ||
    !Number.isFinite(item.quantity)
  );
  if (invalidItems.length > 0) {
    return NextResponse.json({ error: 'Invalid item data' }, { status: 400 });
  }

  // Fix 1: Verify user belongs to this restaurant
  const { data: restaurantMembership } = await supabase
    .from('restaurant_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurant_id)
    .single();

  if (!restaurantMembership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify delivery date is still open
  const { data: deliveryDate } = await supabase
    .from("delivery_dates")
    .select("id, ordering_open")
    .eq("date", delivery_date)
    .single() as any;

  if (!deliveryDate?.ordering_open) {
    return NextResponse.json(
      { error: "Ordering is closed for this delivery date" },
      { status: 409 }
    );
  }

  // Upsert order (one per restaurant per delivery date — unique constraint handles conflict)
  const { data: order, error: orderError } = await (supabase
    .from("orders") as any)
    .upsert(
      {
        restaurant_id,
        chef_id: user.id,
        delivery_date,
        status: "submitted",
        freeform_notes: freeform_notes ?? null,
        submitted_at: new Date().toISOString(),
      },
      {
        onConflict: "restaurant_id,delivery_date",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Order upsert error:", orderError);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  // Fix 4: Get canonical prices from availability_items → items (do not trust client-supplied unit_price)
  const { data: availItems } = await (supabase
    .from('availability_items') as any)
    .select('id, item:items(default_price)')
    .in('id', items.map((i: any) => i.availability_item_id));

  const priceMap = new Map(
    (availItems ?? []).map((a: any) => [a.id, a.item?.default_price ?? null])
  );

  // Delete existing order items then reinsert (simplest approach for re-orders)
  await supabase.from("order_items").delete().eq("order_id", order.id);

  // Insert new order items (skip zero-qty items)
  const orderItems = items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      order_id: order.id,
      availability_item_id: item.availability_item_id,
      quantity_requested: item.quantity,
      unit_price_at_order: priceMap.get(item.availability_item_id) ?? null,
    }));

  if (orderItems.length > 0) {
    const { error: itemsError } = await (supabase.from("order_items") as any).insert(orderItems);

    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
    }
  }

  return NextResponse.json({ data: { orderId: order.id }, error: null }, { status: 200 });
}
