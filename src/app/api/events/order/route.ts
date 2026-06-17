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
    .select("id, item:items(default_price, unit_prices, unit_type)")
    .eq("restaurant_id", restaurantId)
    .eq("delivery_date", delivery_date)
    .neq("status", "unavailable")
    .in("id", submittedIds);

  const availInfo = new Map<
    string,
    { unitPrices: Record<string, number>; defaultPrice: number | null; firstUnit: string | null }
  >(
    (availItems ?? []).map((a: any) => [
      a.id,
      {
        unitPrices: (a.item?.unit_prices ?? {}) as Record<string, number>,
        defaultPrice: typeof a.item?.default_price === "number" ? a.item.default_price : null,
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

  // Build the canonical line shape the submit RPC expects.
  const lines = ordered.map((i) => {
    const info = availInfo.get(i.availability_item_id);
    const unit = (i.unit_type ?? null) || info?.firstUnit || null;
    return {
      availability_item_id: i.availability_item_id,
      quantity_requested: i.quantity,
      unit_price_at_order: resolveOrderUnitPrice(info, unit),
      unit_type: unit,
      size_label: i.size_label ?? null,
      color_key: i.color_key ?? null,
      menu_section: null,
      created_by: user.id,
    };
  });

  // Compose the notes so the event context is visible everywhere the order
  // shows (the admin dashboard already renders freeform_notes); the structured
  // event_date / event_name columns are stamped separately below.
  const eventLabel = (event_name ?? "").trim();
  const eventLine = `Event${eventLabel ? `: ${eventLabel}` : ""} — ${event_date}`;
  const userNote = (freeform_notes ?? "").trim();
  const composedNotes = userNote ? `${eventLine}\n\n${userNote}` : eventLine;

  // Atomic order upsert + item replace via the shared submit RPC (SECURITY
  // INVOKER — the Events account's RLS applies, exactly as a chef's would). We
  // always REPLACE: one order per delivery date for the Events restaurant.
  const { data: orderId, error: submitError } = await (supabase as any).rpc(
    "submit_order_with_items",
    {
      p_restaurant_id: restaurantId,
      p_delivery_date: delivery_date,
      p_freeform_notes: composedNotes,
      p_chef_id: user.id,
      p_last_edited_by: user.id,
      p_replace: true,
      p_lines: lines,
      p_update_lines: [],
      p_idempotency_key: idempotency_key ?? null,
    },
  );

  if (submitError || !orderId) {
    const msg = String(submitError?.message ?? "");
    if (msg.includes("ORDERING_CLOSED")) {
      return NextResponse.json(
        { error: "Ordering is closed for this delivery date." },
        { status: 409 },
      );
    }
    if (msg.includes("ORDER_LOCKED")) {
      return NextResponse.json(
        {
          error:
            "This delivery date's order has already moved past editing — contact Press Farm.",
        },
        { status: 409 },
      );
    }
    console.error("Events order submit RPC error:", submitError);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  // Stamp the structured event columns. Done with the service-role client so it
  // never trips on RLS for these admin-facing columns; the order itself was
  // already created/owned under the Events account above.
  const admin = createAdminClient();
  const { error: stampError } = await (admin as any)
    .from("orders")
    .update({ event_date, event_name: eventLabel || null })
    .eq("id", orderId);
  if (stampError) {
    console.error("Events order event-date stamp error:", stampError);
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
