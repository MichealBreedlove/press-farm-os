import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/api-auth";
import { recordOrderAudit } from "@/lib/order-audit";
import { resolveOrderUnitPrice } from "@/lib/pricing";
import { sendOrderSubmittedEmail } from "@/lib/email";
import { todayPacific } from "@/lib/utils";

/**
 * POST /api/events/order — Events-team order submission.
 *
 * The Events team has its own ordering system (separate from the chef /order +
 * /events request flows). Unlike chefs, they pick BOTH:
 *   • event_date    — the day of the event itself
 *   • delivery_date — when the items should be delivered (drives availability,
 *                     harvest, and the admin orders dashboard)
 *
 * Submissions are AUTO-CONFIRMED: they land straight in the orders system for
 * the chosen delivery date (no admin review step). One order per delivery date
 * for the Events restaurant — re-submitting REPLACES that order's items
 * ("last save wins", same rule as chef orders).
 *
 * Gating: only the shared Events account (restaurant slug 'events') may post
 * here. The Events restaurant id is derived server-side from the session — the
 * client never supplies a restaurant id.
 *
 * Items are validated against published Events availability for the delivery
 * date (the same scoped, anti-tamper check the chef route uses).
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const auth = await requireUser(supabase);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  // Resolve the caller's restaurant and confirm it's the Events account. The
  // restaurant id is taken from the membership row, never from the request, so
  // a chef can't post an event order against another restaurant.
  const { data: membership } = await (supabase as any)
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name, slug)")
    .eq("user_id", user.id)
    .single();

  const restaurant = membership?.restaurants;
  if (!restaurant || restaurant.slug !== "events") {
    return NextResponse.json(
      { error: "This ordering system is for the Events team only." },
      { status: 403 },
    );
  }
  const restaurantId: string = restaurant.id;

  let body: {
    delivery_date?: string;
    event_date?: string;
    event_name?: string | null;
    freeform_notes?: string | null;
    idempotency_key?: string | null;
    items?: {
      availability_item_id: string;
      quantity: number;
      unit_type?: string | null;
      size_label?: string | null;
      color_key?: string | null;
    }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    delivery_date,
    event_date,
    event_name,
    freeform_notes,
    idempotency_key,
    items,
  } = body;

  if (!delivery_date || !event_date || !Array.isArray(items)) {
    return NextResponse.json(
      { error: "Missing required fields: delivery_date, event_date, items" },
      { status: 400 },
    );
  }

  // What the event is, when it is, and when it's delivered are all required.
  const eventLabel = (event_name ?? "").trim();
  if (!eventLabel) {
    return NextResponse.json(
      { error: "Tell us what the event is (event name is required)." },
      { status: 400 },
    );
  }

  const today = todayPacific();
  if (event_date < today) {
    return NextResponse.json(
      { error: "The event date must be today or later." },
      { status: 400 },
    );
  }

  // Only positive-quantity lines are persisted. Reject an all-empty submission
  // so we never create a phantom order with no items.
  const ordered = items.filter(
    (i) => i && typeof i.quantity === "number" && i.quantity > 0 && i.availability_item_id,
  );
  if (ordered.length === 0) {
    return NextResponse.json(
      { error: "Add at least one item before submitting." },
      { status: 400 },
    );
  }

  // Delivery date must be a real, open delivery date.
  const { data: deliveryDate } = await (supabase as any)
    .from("delivery_dates")
    .select("id, ordering_open")
    .eq("date", delivery_date)
    .single();

  if (!deliveryDate?.ordering_open) {
    return NextResponse.json(
      { error: "Ordering is closed for this delivery date." },
      { status: 409 },
    );
  }

  // Validate every line against published Events availability for this date —
  // don't trust client-supplied availability ids (a tampered id could point at
  // another restaurant, date, or an unavailable item). Pull pricing inputs so
  // we can freeze the per-unit price onto each line.
  const submittedIds = ordered.map((i) => i.availability_item_id);
  const { data: availItems } = await (supabase as any)
    .from("availability_items")
    .select("id, item:items(default_price, unit_prices, size_prices, unit_type)")
    .eq("restaurant_id", restaurantId)
    .eq("delivery_date", delivery_date)
    .neq("status", "unavailable")
    .in("id", submittedIds);

  const availInfo = new Map<
    string,
    {
      unitPrices: Record<string, number>;
      defaultPrice: number | null;
      sizePrices: Record<string, number> | null;
      firstUnit: string | null;
    }
  >(
    (availItems ?? []).map((a: any) => [
      a.id,
      {
        unitPrices: (a.item?.unit_prices ?? {}) as Record<string, number>,
        defaultPrice: typeof a.item?.default_price === "number" ? a.item.default_price : null,
        sizePrices: (a.item?.size_prices ?? null) as Record<string, number> | null,
        firstUnit: String(a.item?.unit_type ?? "").split(",")[0]?.trim() || null,
      },
    ]),
  );

  const tampered = submittedIds.filter((id) => !availInfo.has(id));
  if (tampered.length > 0) {
    return NextResponse.json(
      {
        error:
          "Some items are no longer available for this delivery date. Reload the page and re-add them.",
      },
      { status: 400 },
    );
  }

  // Build each order_items line, freezing the per-unit price.
  const lines = ordered.map((i) => {
    const info = availInfo.get(i.availability_item_id);
    const unit = (i.unit_type ?? null) || info?.firstUnit || null;
    return {
      availability_item_id: i.availability_item_id,
      quantity_requested: i.quantity,
      unit_price_at_order: resolveOrderUnitPrice(info, unit, i.size_label ?? null),
      unit_type: unit,
      size_label: i.size_label ?? null,
      color_key: i.color_key ?? null,
      menu_section: null,
      created_by: user.id,
    };
  });

  // Compose the notes so the event context is visible everywhere the order
  // shows (the admin dashboard already renders freeform_notes); the structured
  // event_date / event_name columns are stored on the row too.
  const eventLine = `Event: ${eventLabel} — ${event_date}`;
  const userNote = (freeform_notes ?? "").trim();
  const composedNotes = userNote ? `${eventLine}\n\n${userNote}` : eventLine;

  // Events orders are NOT one-per-delivery-date: each submission is its own
  // order so two events delivering the same day stay separate (migration 070
  // makes the orders uniqueness partial — chef orders only). So we INSERT a
  // fresh order every time rather than upserting through the chef RPC. Writes
  // go through the service-role client; the route already authenticated the
  // Events account and derived the restaurant server-side.
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Idempotency: a retry carrying the same token must not create a second
  // order. Tokens are unique per submission (the client mints a new one each
  // time), so a prior order with this token means the write already landed.
  if (idempotency_key) {
    const { data: dupe } = await (admin as any)
      .from("orders")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("last_submission_token", idempotency_key)
      .maybeSingle();
    if (dupe?.id) {
      return NextResponse.json({ data: { orderId: dupe.id }, error: null }, { status: 200 });
    }
  }

  const { data: inserted, error: insertError } = await (admin as any)
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      chef_id: user.id,
      delivery_date,
      status: "submitted",
      freeform_notes: composedNotes,
      submitted_at: now,
      last_edited_by: user.id,
      last_edited_at: now,
      last_submission_token: idempotency_key ?? null,
      event_date,
      event_name: eventLabel,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    console.error("Events order insert error:", insertError);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }
  const orderId: string = inserted.id;

  const { error: itemsError } = await (admin as any)
    .from("order_items")
    .insert(lines.map((l) => ({ ...l, order_id: orderId })));
  if (itemsError) {
    // Roll back the just-created order so we never leave an empty event order.
    await (admin as any).from("orders").delete().eq("id", orderId);
    console.error("Events order items insert error:", itemsError);
    return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
  }

  // Accountability + admin notification — both best-effort, never fail the order.
  const { data: actorProfile } = await (supabase as any)
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const actorName: string | null = actorProfile?.full_name ?? null;

  await recordOrderAudit(admin, {
    orderId: orderId as string,
    restaurantId,
    deliveryDate: delivery_date,
    actorId: user.id,
    actorName,
    action: "submitted",
    detail: { delivery_date, event_date, event_name: eventLabel || null, item_count: lines.length },
  });

  try {
    const orderedAvailIds = lines.map((l) => l.availability_item_id);
    const { data: availDetails } = await (admin as any)
      .from("availability_items")
      .select("id, item:items(name, unit_type)")
      .in("id", orderedAvailIds);
    const nameMap = new Map((availDetails ?? []).map((a: any) => [a.id, a.item]));
    const emailItems = lines.map((l) => {
      const item = nameMap.get(l.availability_item_id) as any;
      return {
        itemName: item?.name ?? "Unknown item",
        quantity: l.quantity_requested,
        unit: l.unit_type ?? String(item?.unit_type ?? "").split(",")[0]?.trim() ?? "",
      };
    });
    await sendOrderSubmittedEmail({
      restaurantName: `Events${eventLabel ? ` · ${eventLabel}` : ""}`,
      chefName: actorName ?? "Events team",
      deliveryDate: delivery_date,
      items: emailItems,
      freeformNotes: composedNotes,
      submittedAt: new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
    });
  } catch (emailErr) {
    console.error("[EMAIL] Failed to send events order notification:", emailErr);
  }

  return NextResponse.json({ data: { orderId: orderId as string }, error: null }, { status: 200 });
}
