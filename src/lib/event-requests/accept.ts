import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

interface AcceptableRequest {
  id: string;
  restaurant_id: string;
  chef_id: string;
  item_id: string;
  quantity: number;
  unit: string;
  needed_by_date: string;
  event_name: string | null;
  notes: string | null;
}

export interface AcceptedLine {
  request_id: string;
  order_id: string;
  order_item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

/**
 * Run the accept-flow for a single event request: ensure delivery_date,
 * upsert availability, find-or-create order, insert order_item, stamp
 * the request as accepted. Caller is responsible for the email.
 *
 * Returns the created line on success, throws on any DB failure.
 */
export async function acceptEventRequest(
  admin: AdminClient,
  request: AcceptableRequest,
  respondedByUserId: string,
  adminResponse: string | null,
): Promise<AcceptedLine> {
  const date = request.needed_by_date;

  // 1. Ensure delivery_dates row exists for the date (off-schedule = 'custom').
  const { data: existingDate } = await (admin as any)
    .from("delivery_dates")
    .select("id")
    .eq("date", date)
    .maybeSingle();

  if (!existingDate) {
    const dow = new Date(date + "T12:00:00").getDay();
    const dowMap: Record<number, "thursday" | "saturday" | "monday" | "custom"> = {
      1: "monday",
      4: "thursday",
      6: "saturday",
    };
    const day_of_week = dowMap[dow] ?? "custom";
    const { error: ddErr } = await (admin as any)
      .from("delivery_dates")
      .insert({ date, day_of_week, ordering_open: true });
    if (ddErr) throw new Error(`delivery_dates: ${ddErr.message}`);
  }

  // 2. Resolve item for pricing + name.
  const { data: item } = await (admin as any)
    .from("items")
    .select("id, name, unit_type, unit_prices, default_price")
    .eq("id", request.item_id)
    .single();
  if (!item) throw new Error("Item missing");

  const unitPrices = (item.unit_prices ?? {}) as Record<string, number>;
  const unitPrice =
    Number(unitPrices[request.unit] ?? item.default_price ?? 0) || null;

  // 3. Upsert availability_items.
  const { data: existingAvail } = await (admin as any)
    .from("availability_items")
    .select("id")
    .eq("item_id", request.item_id)
    .eq("restaurant_id", request.restaurant_id)
    .eq("delivery_date", date)
    .maybeSingle();

  let availabilityItemId: string;
  if (existingAvail) {
    availabilityItemId = existingAvail.id;
  } else {
    const { data: newAvail, error: availErr } = await (admin as any)
      .from("availability_items")
      .insert({
        item_id: request.item_id,
        restaurant_id: request.restaurant_id,
        delivery_date: date,
        status: "available",
      })
      .select("id")
      .single();
    if (availErr || !newAvail) throw new Error(`availability: ${availErr?.message ?? "insert failed"}`);
    availabilityItemId = newAvail.id;
  }

  // 4. Find-or-create the orders row (UNIQUE on restaurant_id + delivery_date).
  const { data: existingOrder } = await (admin as any)
    .from("orders")
    .select("id")
    .eq("restaurant_id", request.restaurant_id)
    .eq("delivery_date", date)
    .maybeSingle();

  let orderId: string;
  if (existingOrder) {
    orderId = existingOrder.id;
  } else {
    const { data: newOrder, error: orderErr } = await (admin as any)
      .from("orders")
      .insert({
        restaurant_id: request.restaurant_id,
        chef_id: request.chef_id,
        delivery_date: date,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        freeform_notes: request.event_name
          ? `Event: ${request.event_name}${request.notes ? ` — ${request.notes}` : ""}`
          : (request.notes ?? null),
      })
      .select("id")
      .single();
    if (orderErr || !newOrder) throw new Error(`order: ${orderErr?.message ?? "insert failed"}`);
    orderId = newOrder.id;
  }

  // 5. Insert the order_items line.
  const firstUnit = String(item.unit_type ?? "").split(",")[0]?.trim() || null;
  const { data: oi, error: oiErr } = await (admin as any)
    .from("order_items")
    .insert({
      order_id: orderId,
      availability_item_id: availabilityItemId,
      quantity_requested: request.quantity,
      unit_price_at_order: unitPrice,
      unit_type: request.unit || firstUnit,
      size_label: null,
      color_key: null,
    })
    .select("id")
    .single();
  if (oiErr || !oi) throw new Error(`order_item: ${oiErr?.message ?? "insert failed"}`);

  // 6. Stamp the request accepted.
  const { error: stampErr } = await (admin as any)
    .from("event_requests")
    .update({
      status: "accepted",
      admin_response: adminResponse,
      responded_at: new Date().toISOString(),
      responded_by: respondedByUserId,
      order_item_id: oi.id,
    })
    .eq("id", request.id);
  if (stampErr) throw new Error(stampErr.message);

  return {
    request_id: request.id,
    order_id: orderId,
    order_item_id: oi.id,
    item_name: item.name,
    quantity: Number(request.quantity),
    unit: request.unit,
  };
}
