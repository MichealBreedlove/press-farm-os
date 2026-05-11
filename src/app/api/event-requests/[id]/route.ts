import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEventRequestAcceptedEmail } from "@/lib/email";

type Params = Promise<{ id: string }>;

interface PatchBody {
  action?: "accept" | "decline";
  admin_response?: string | null;
}

/**
 * PATCH /api/event-requests/[id]
 *
 * Admin-only. Accept or decline a pending event request. On accept this
 * stitches together everything needed to surface the line in the normal
 * order pipeline:
 *   1. Ensure a delivery_dates row exists for needed_by_date
 *      (off-schedule = day_of_week 'custom', same as /api/order/open-date).
 *   2. Upsert an availability_items row for the (item, restaurant, date)
 *      so the item appears on harvest list + order detail views.
 *   3. Find-or-create the orders row for (restaurant, date).
 *   4. Insert an order_items line priced from unit_prices[unit] or default_price.
 *   5. Link order_item_id back on event_requests; mark accepted.
 *   6. Email the chef with the confirmation.
 *
 * Decline just stamps status + admin_response.
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = await params;
  const action = body.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: req, error: fetchErr } = await (admin as any)
    .from("event_requests")
    .select(
      "id, restaurant_id, chef_id, item_id, quantity, unit, needed_by_date, event_name, notes, status",
    )
    .eq("id", id)
    .single();
  if (fetchErr || !req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "pending") {
    return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 400 });
  }

  if (action === "decline") {
    const { error: updErr } = await (admin as any)
      .from("event_requests")
      .update({
        status: "declined",
        admin_response: body.admin_response ?? null,
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  // -- Accept path --

  // 1. Ensure delivery_dates row exists for needed_by_date
  const date = req.needed_by_date as string;
  const { data: existingDate } = await (admin as any)
    .from("delivery_dates")
    .select("id, ordering_open")
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
    if (ddErr) return NextResponse.json({ error: `delivery_dates: ${ddErr.message}` }, { status: 500 });
  }

  // 2. Fetch item for pricing + naming
  const { data: item } = await (admin as any)
    .from("items")
    .select("id, name, unit_type, unit_prices, default_price")
    .eq("id", req.item_id)
    .single();
  if (!item) return NextResponse.json({ error: "Item missing" }, { status: 500 });

  const unitPrices = (item.unit_prices ?? {}) as Record<string, number>;
  const unitPrice =
    Number(unitPrices[req.unit] ?? item.default_price ?? 0) || null;

  // 3. Upsert availability_items row (idempotent on item+restaurant+date unique)
  const { data: existingAvail } = await (admin as any)
    .from("availability_items")
    .select("id")
    .eq("item_id", req.item_id)
    .eq("restaurant_id", req.restaurant_id)
    .eq("delivery_date", date)
    .maybeSingle();

  let availabilityItemId: string;
  if (existingAvail) {
    availabilityItemId = existingAvail.id;
  } else {
    const { data: newAvail, error: availErr } = await (admin as any)
      .from("availability_items")
      .insert({
        item_id: req.item_id,
        restaurant_id: req.restaurant_id,
        delivery_date: date,
        status: "available",
      })
      .select("id")
      .single();
    if (availErr || !newAvail) {
      return NextResponse.json({ error: `availability: ${availErr?.message ?? "insert failed"}` }, { status: 500 });
    }
    availabilityItemId = newAvail.id;
  }

  // 4. Find-or-create the orders row (UNIQUE on restaurant_id + delivery_date)
  const { data: existingOrder } = await (admin as any)
    .from("orders")
    .select("id")
    .eq("restaurant_id", req.restaurant_id)
    .eq("delivery_date", date)
    .maybeSingle();

  let orderId: string;
  if (existingOrder) {
    orderId = existingOrder.id;
  } else {
    const { data: newOrder, error: orderErr } = await (admin as any)
      .from("orders")
      .insert({
        restaurant_id: req.restaurant_id,
        chef_id: req.chef_id,
        delivery_date: date,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        freeform_notes: req.event_name
          ? `Event: ${req.event_name}${req.notes ? ` — ${req.notes}` : ""}`
          : (req.notes ?? null),
      })
      .select("id")
      .single();
    if (orderErr || !newOrder) {
      return NextResponse.json({ error: `order: ${orderErr?.message ?? "insert failed"}` }, { status: 500 });
    }
    orderId = newOrder.id;
  }

  // 5. Insert order_items line. We don't merge into an existing identical
  // line — each accepted event request is its own line so admin can trace
  // it back via order_item_id.
  const firstUnit = String(item.unit_type ?? "").split(",")[0]?.trim() || null;
  const { data: oi, error: oiErr } = await (admin as any)
    .from("order_items")
    .insert({
      order_id: orderId,
      availability_item_id: availabilityItemId,
      quantity_requested: req.quantity,
      unit_price_at_order: unitPrice,
      unit_type: req.unit || firstUnit,
      size_label: null,
      color_key: null,
    })
    .select("id")
    .single();
  if (oiErr || !oi) {
    return NextResponse.json({ error: `order_item: ${oiErr?.message ?? "insert failed"}` }, { status: 500 });
  }

  // 6. Stamp the request as accepted with the order_item link
  const { error: stampErr } = await (admin as any)
    .from("event_requests")
    .update({
      status: "accepted",
      admin_response: body.admin_response ?? null,
      responded_at: new Date().toISOString(),
      responded_by: user.id,
      order_item_id: oi.id,
    })
    .eq("id", id);
  if (stampErr) return NextResponse.json({ error: stampErr.message }, { status: 500 });

  // 7. Email the chef. Best-effort — never fails the API.
  try {
    const { data: chef } = await (admin as any)
      .from("profiles")
      .select("full_name")
      .eq("id", req.chef_id)
      .single();
    const { data: chefAuth } = await admin.auth.admin.getUserById(req.chef_id);
    const chefEmail = chefAuth?.user?.email ?? null;
    const { data: rest } = await (admin as any)
      .from("restaurants")
      .select("name")
      .eq("id", req.restaurant_id)
      .single();

    if (chefEmail) {
      await sendEventRequestAcceptedEmail({
        toEmail: chefEmail,
        chefName: chef?.full_name ?? "Chef",
        restaurantName: rest?.name ?? "your restaurant",
        deliveryDate: date,
        itemName: item.name,
        quantity: Number(req.quantity),
        unit: req.unit,
        eventName: req.event_name ?? null,
        adminResponse: body.admin_response ?? null,
      });
    }
  } catch (err) {
    console.error("[EVENT REQUEST] accept email failed:", err);
  }

  return NextResponse.json({
    ok: true,
    status: "accepted",
    order_id: orderId,
    order_item_id: oi.id,
  });
}
