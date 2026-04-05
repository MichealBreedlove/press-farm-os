import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderReceivedEmail, sendOrderConfirmationEmail } from "@/lib/notifications";

/**
 * POST /api/orders — Submit or update a chef's order
 *
 * Body: { restaurant_id, delivery_date, items: [{availability_item_id, quantity_requested}], freeform_notes, order_id? }
 *
 * Creates order + order_items (upserts if order already exists).
 * Sends email notifications via Resend.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    restaurant_id: string;
    delivery_date: string;
    items: { availability_item_id: string; quantity_requested: number }[];
    freeform_notes?: string | null;
    order_id?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { restaurant_id, delivery_date, items, freeform_notes, order_id } = body;
  if (!restaurant_id || !delivery_date || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify chef belongs to this restaurant
  const { data: membership } = await supabase
    .from("restaurant_users")
    .select("id")
    .eq("user_id", user.id)
    .eq("restaurant_id", restaurant_id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not authorized for this restaurant" }, { status: 403 });
  }

  // Verify ordering is open
  const { data: dd } = await supabase
    .from("delivery_dates")
    .select("ordering_open")
    .eq("date", delivery_date)
    .single();

  if (!dd?.ordering_open) {
    return NextResponse.json({ error: "Ordering is closed for this date" }, { status: 400 });
  }

  let orderId = order_id;

  if (orderId) {
    // Update existing order
    const { error } = await admin
      .from("orders")
      .update({
        freeform_notes: freeform_notes ?? null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Delete old items and re-insert
    await admin.from("order_items").delete().eq("order_id", orderId);
  } else {
    // Create new order
    const { data: newOrder, error } = await admin
      .from("orders")
      .insert({
        restaurant_id,
        chef_id: user.id,
        delivery_date,
        status: "submitted",
        freeform_notes: freeform_notes ?? null,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    orderId = newOrder.id;
  }

  // Insert order items
  if (items.length > 0) {
    const orderItems = items.map((item) => ({
      order_id: orderId!,
      availability_item_id: item.availability_item_id,
      quantity_requested: item.quantity_requested,
    }));
    const { error } = await admin.from("order_items").insert(orderItems);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send notifications (non-blocking)
  try {
    await Promise.allSettled([
      sendOrderReceivedEmail({ orderId: orderId!, restaurantId: restaurant_id, deliveryDate: delivery_date }),
      sendOrderConfirmationEmail({ userId: user.id, orderId: orderId!, deliveryDate: delivery_date }),
    ]);
  } catch {
    // Notifications are best-effort — don't fail the order
  }

  return NextResponse.json({ order_id: orderId }, { status: 200 });
}
