import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendShortageEmail } from "@/lib/email";

/**
 * PATCH /api/orders/[orderId]/shortage — Mark order items as shorted (admin only)
 *
 * Body: { items: [{order_item_id, quantity_fulfilled, shortage_reason}] }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const supabase = await createClient();
  const { orderId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin
  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profileRaw || profileRaw.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { items: { order_item_id: string; quantity_fulfilled: number; shortage_reason: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Missing items array" }, { status: 400 });
  }

  const invalidItems = items.filter((item: any) =>
    !item.order_item_id ||
    typeof item.quantity_fulfilled !== 'number' ||
    !Number.isFinite(item.quantity_fulfilled) ||
    item.quantity_fulfilled < 0
  );
  if (invalidItems.length > 0) {
    return NextResponse.json({ error: 'Invalid shortage item data' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Verify the order exists
  const { data: order, error: orderError } = await (adminClient.from("orders") as any)
    .select("id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Update each order item with shortage info
  const updates = await Promise.all(
    items.map(({ order_item_id, quantity_fulfilled, shortage_reason }) =>
      (adminClient.from("order_items") as any)
        .update({
          is_shorted: true,
          quantity_fulfilled,
          shortage_reason,
        })
        .eq("id", order_item_id)
        .eq("order_id", orderId)
    )
  );

  const firstError = updates.find((r) => r.error);
  if (firstError?.error) {
    console.error("Shortage update error:", firstError.error);
    return NextResponse.json({ error: "Failed to update shortage info" }, { status: 500 });
  }

  // Fetch updated order with full details (for response + email)
  const { data: updatedOrder, error: fetchError } = await (adminClient.from("orders") as any)
    .select(`
      *,
      delivery_date,
      chef_id,
      restaurant:restaurants(name),
      chef:profiles!orders_chef_id_fkey(full_name),
      order_items(
        id,
        quantity_requested,
        quantity_fulfilled,
        is_shorted,
        shortage_reason,
        availability_item:availability_items(
          item:items(name, unit)
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch updated order" }, { status: 500 });
  }

  // Send shortage notice email to the chef — non-blocking, errors do not fail the response
  try {
    const shortedItems = (updatedOrder?.order_items ?? []).filter((oi: any) => oi.is_shorted);

    if (shortedItems.length > 0 && updatedOrder?.chef_id) {
      const { data: chefUserData } = await adminClient.auth.admin.getUserById(updatedOrder.chef_id);
      const chefEmail = chefUserData?.user?.email;

      if (chefEmail) {
        const shortages = shortedItems.map((oi: any) => ({
          itemName: oi.availability_item?.item?.name ?? "Unknown item",
          requestedQty: oi.quantity_requested,
          fulfilledQty: oi.quantity_fulfilled ?? 0,
          unit: oi.availability_item?.item?.unit ?? "",
          reason: oi.shortage_reason ?? "",
        }));

        await sendShortageEmail({
          toEmail: chefEmail,
          chefName: updatedOrder.chef?.full_name ?? "Chef",
          restaurantName: updatedOrder.restaurant?.name ?? "Restaurant",
          deliveryDate: updatedOrder.delivery_date,
          shortages,
        });
      }
    }
  } catch (emailErr) {
    console.error("[EMAIL] Failed to send shortage notice email:", emailErr);
  }

  return NextResponse.json({ data: updatedOrder, error: null });
}
