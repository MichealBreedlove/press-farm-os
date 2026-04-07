import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  // Fetch updated order with items
  const { data: updatedOrder, error: fetchError } = await (adminClient.from("orders") as any)
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch updated order" }, { status: 500 });
  }

  return NextResponse.json({ data: updatedOrder, error: null });
}
