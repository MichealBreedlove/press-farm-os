import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";
import { sendOrderConfirmedEmail } from "@/lib/email";

/**
 * PATCH /api/orders/[orderId] — Update order status (admin only)
 *
 * Body: { status: OrderStatus }
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

  let body: { status: OrderStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status } = body;
  const validStatuses: OrderStatus[] = ["draft", "submitted", "in_progress", "fulfilled", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: order, error } = await (adminClient.from("orders") as any)
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !order) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }

  // When status changes to 'fulfilled', send confirmation email to the chef
  if (status === "fulfilled") {
    try {
      // Fetch order with order_items, restaurant, chef profile, and item details
      const { data: fullOrder } = await (adminClient.from("orders") as any)
        .select(`
          delivery_date,
          restaurant:restaurants(name),
          chef:profiles!orders_chef_id_fkey(full_name),
          order_items(
            quantity_requested,
            quantity_fulfilled,
            is_shorted,
            availability_item:availability_items(
              item:items(name, unit)
            )
          )
        `)
        .eq("id", orderId)
        .single();

      if (fullOrder) {
        // Fetch chef's email via admin auth API (bypasses RLS)
        const { data: chefUserData } = await adminClient.auth.admin.getUserById(order.chef_id);
        const chefEmail = chefUserData?.user?.email;

        if (chefEmail) {
          const items = (fullOrder.order_items ?? []).map((oi: any) => ({
            itemName: oi.availability_item?.item?.name ?? "Unknown item",
            requestedQty: oi.quantity_requested,
            fulfilledQty: oi.quantity_fulfilled ?? oi.quantity_requested,
            unit: oi.availability_item?.item?.unit ?? "",
            isShorted: oi.is_shorted ?? false,
          }));

          await sendOrderConfirmedEmail({
            toEmail: chefEmail,
            chefName: fullOrder.chef?.full_name ?? "Chef",
            restaurantName: fullOrder.restaurant?.name ?? "Restaurant",
            deliveryDate: fullOrder.delivery_date,
            items,
          });
        }
      }
    } catch (emailErr) {
      console.error("[EMAIL] Failed to send order confirmed email:", emailErr);
    }
  }

  return NextResponse.json({ data: order, error: null });
}

/**
 * DELETE /api/orders/[orderId] — Delete an order and its items (admin only)
 */
export async function DELETE(
  _request: Request,
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

  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profileRaw || profileRaw.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // Delete order_items first (FK constraint)
  await (adminClient.from("order_items") as any).delete().eq("order_id", orderId);

  // Delete the order
  const { error } = await (adminClient.from("orders") as any).delete().eq("id", orderId);

  if (error) {
    console.error("Order delete error:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
