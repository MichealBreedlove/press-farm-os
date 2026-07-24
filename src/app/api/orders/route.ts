import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { sendOrderSubmittedEmail, sendOrderConfirmationEmail } from "@/lib/email";
import { recordOrderAudit } from "@/lib/order-audit";
import { resolveOrderUnitPrice } from "@/lib/pricing";
import { planOrderItemMerge } from "@/lib/orders";
import { minOrderableDatePacific, ORDER_CUTOFF_HOUR_PACIFIC } from "@/lib/utils";

/**
 * GET /api/orders?date=YYYY-MM-DD — Fetch orders for a delivery date (admin only)
 *
 * Returns orders with restaurant, chef profile, and order_items count.
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Missing date query param" }, { status: 400 });
  }

  const { data: orders, error } = await (supabase as any)
    .from("orders")
    .select(`
      id, delivery_date, status, freeform_notes, submitted_at,
      restaurant:restaurants(id, name),
      chef:profiles!orders_chef_id_fkey(id, full_name),
      order_items(id)
    `)
    .eq("delivery_date", date);

  if (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }

  return NextResponse.json({ data: orders ?? [], error: null });
}

/**
 * POST /api/orders — Submit or update an order
 *
 * Body: { restaurant_id, delivery_date, items: [{availability_item_id, quantity, unit_price}], freeform_notes }
 *
 * Upserts order and order_items (one order per restaurant per delivery date).
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const auth = await requireUser(supabase);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let body: {
    restaurant_id: string;
    delivery_date: string;
    items: {
      availability_item_id: string;
      quantity: number;
      unit_price?: number | null;
      /** Single unit code chosen by the chef (sm/lg/ea/...). Required for new orders. */
      unit_type?: string | null;
      /** Size descriptor when the item has sizes ("Quarter", "Palm", ...). null when none. */
      size_label?: string | null;
      /** Comma-separated colors selected for this line ("red,blue"). null when none. */
      color_key?: string | null;
      /** Comma-separated varieties selected for this line ("Genovese,Thai"). null when none. */
      variety_key?: string | null;
      /** Order-form section the line came from. 'events' keeps an Events-menu
       *  line distinct from the Regular-menu line for the same item. */
      menu_section?: string | null;
    }[];
    freeform_notes?: string;
    /** When set, this is an explicit edit — replace existing items.
     *  When omitted, a second submission for the same date MERGES new items
     *  into the existing order (matching availId+unit+size+color+variety sums
     *  qty; unmatched lines are appended). */
    editing_order_id?: string | null;
    /** Per-review-session idempotency token. The client mints one token when
     *  the chef enters review and reuses it across retries (e.g. a lost
     *  response on a flaky connection). A repeat POST carrying the same token
     *  as the existing order is a no-op — without it, a merge-mode retry would
     *  silently double every quantity. */
    idempotency_key?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { restaurant_id, delivery_date, items, freeform_notes, editing_order_id, idempotency_key } = body;

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

  // Reject an empty submission outright. Only positive-quantity lines are ever
  // persisted (the qty>0 filter below), so a body with no positive line would
  // otherwise create a phantom 'submitted' order with zero items and fire two
  // empty notification emails. Clearing an order is a distinct action, not a
  // silent empty submit.
  const orderedInput = items.filter((i: any) => Number(i.quantity) > 0);
  if (orderedInput.length === 0) {
    return NextResponse.json(
      { error: "Add at least one item before submitting." },
      { status: 400 },
    );
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

  // Fetch the existing order up front so the idempotency short-circuit can run
  // BEFORE the ordering-open and status gates below. A retry of an
  // already-committed submission must report success even if an admin closed
  // the date or advanced the order in the meantime — the original write landed
  // while everything was open. (The submit RPC orders these same checks the
  // same way.)
  const { data: existingOrder } = await (supabase.from("orders") as any)
    .select("id, status, chef_id, last_submission_token")
    .eq("restaurant_id", restaurant_id)
    .eq("delivery_date", delivery_date)
    .maybeSingle();

  // Idempotency: a retry of a submission that already committed (e.g. the
  // response was lost on a flaky connection). The same token on the existing
  // order means this exact submission already landed — return success without
  // re-merging (which doubles quantities) or re-notifying.
  if (existingOrder && idempotency_key && existingOrder.last_submission_token === idempotency_key) {
    return NextResponse.json({ data: { orderId: existingOrder.id }, error: null }, { status: 200 });
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

  // Ordering cutoff backstop: after 5pm Pacific, today's harvest is done, so
  // a submission for today (or any past date) must roll to the next harvest
  // day — even if the admin never flipped ordering_open off. This is what
  // catches a stale form left open across the cutoff.
  if (delivery_date < minOrderableDatePacific()) {
    return NextResponse.json(
      {
        error: `Ordering for ${delivery_date} has closed (orders after ${ORDER_CUTOFF_HOUR_PACIFIC - 12}pm go to the next harvest day). Please go back to the order page and resubmit for the next delivery date.`,
      },
      { status: 409 },
    );
  }

  // Reject re-submits when admin has already moved the order out of the
  // chef-editable states. Otherwise a chef could overwrite an order that
  // admin already started picking, fulfilled, or cancelled — including
  // racing with a "Finish & Send" that just emailed the receiver.
  if (existingOrder && !["draft", "submitted"].includes(existingOrder.status)) {
    return NextResponse.json(
      {
        error: `This order has already moved to "${existingOrder.status}" — contact Press Farm to make changes.`,
      },
      { status: 409 },
    );
  }

  // Merge mode = chef submits a fresh order for a date that already has one,
  // and they're NOT in the explicit edit flow. Append new lines (summing qty
  // when availId+unit+size+color match) instead of wiping the existing items.
  const isMerge = !!existingOrder && !editing_order_id;

  // Upsert order (one per restaurant per delivery date — unique constraint handles conflict).
  // Merge mode preserves existing freeform_notes and appends the new note (if any),
  // so a chef who adds a follow-up order doesn't wipe the original instructions.
  let mergedNotes: string | null = freeform_notes ?? null;
  if (isMerge) {
    const { data: cur } = await (supabase.from("orders") as any)
      .select("freeform_notes")
      .eq("id", existingOrder!.id)
      .single();
    const prior = (cur?.freeform_notes ?? "").trim();
    const next = (freeform_notes ?? "").trim();
    if (prior && next) {
      mergedNotes = `${prior}\n\n— Added later —\n${next}`;
    } else {
      mergedNotes = prior || next || null;
    }
  }

  const isNewOrder = !existingOrder;

  // Fetch canonical availability rows scoped to THIS restaurant + date + not
  // unavailable. Don't trust client-supplied availability_item_ids — a
  // tampered ID could otherwise reference another restaurant's availability,
  // a different date, or an unavailable item. We require every submitted ID
  // to round-trip through this scoped fetch. Pull unit_type so we can
  // backfill the per-line unit when the client omits it (legacy callers).
  // Validate only the lines we'll actually persist (qty>0). Building this from
  // the raw items would let a stray zero-quantity line referencing a
  // now-unavailable item fail the whole submission with "no longer available".
  const submittedIds = orderedInput.map((i: any) => i.availability_item_id);
  const { data: availItems } = await (supabase.from("availability_items") as any)
    .select("id, item:items(default_price, unit_prices, size_prices, unit_type)")
    .eq("restaurant_id", restaurant_id)
    .eq("delivery_date", delivery_date)
    .neq("status", "unavailable")
    .in("id", submittedIds);

  const validIdSet = new Set((availItems ?? []).map((a: any) => a.id));
  const tamperedIds = submittedIds.filter((id: string) => !validIdSet.has(id));
  if (tamperedIds.length > 0) {
    // Most often this is a STALE cart, not tampering: the chef loaded the
    // form, the admin republished availability (changing/removing rows),
    // and the cart's availability IDs no longer match this date. Tell the
    // chef how to recover instead of leaving them stuck (2026-06-10 incident).
    //
    // Best case the rows still exist but were flipped to unavailable mid-
    // session — then name the exact items so the chef removes just those
    // instead of rebuilding the whole order.
    const { data: unavailRows } = await (supabase.from("availability_items") as any)
      .select("id, item:items(name)")
      .eq("restaurant_id", restaurant_id)
      .eq("delivery_date", delivery_date)
      .eq("status", "unavailable")
      .in("id", tamperedIds);
    const unavailableNames: string[] = (unavailRows ?? [])
      .map((r: any) => r.item?.name)
      .filter(Boolean);
    if (unavailableNames.length === tamperedIds.length) {
      return NextResponse.json(
        {
          error: `No longer available for this delivery: ${unavailableNames.join(", ")}. Go back, remove ${
            unavailableNames.length === 1 ? "that item" : "those items"
          }, and resubmit — the rest of your order is fine.`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          "The availability list changed since you loaded the order form, so some items in your cart are no longer valid. Please go back to the order page, refresh, and re-add your items.",
      },
      { status: 400 },
    );
  }

  // Per-availability info we need for line construction: per-unit price map,
  // catalog fallback price, and the canonical first unit. Per-unit pricing was
  // added in migration 022; before this fix only `default_price` was read, so
  // multi-unit items with `unit_prices[unit]` overrides locked in the wrong
  // price.
  const availInfoMap = new Map<
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
        defaultPrice:
          typeof a.item?.default_price === "number" ? a.item.default_price : null,
        sizePrices: (a.item?.size_prices ?? null) as Record<string, number> | null,
        firstUnit: String(a.item?.unit_type ?? "").split(",")[0]?.trim() || null,
      },
    ]),
  );

  // Resolve the price for a given availability+unit+size. Precedence:
  // size_prices[size] → unit_prices[unit] → default_price → 0. Defaulting to 0
  // (instead of null) keeps the line in the COALESCE(SUM(line_total)) revenue
  // rollup; a NULL line_total would silently disappear from totals.
  // (resolveOrderUnitPrice is the unit-tested core — see src/lib/pricing.ts.)
  function resolvePrice(availId: string, unit: string | null, size: string | null): number {
    return resolveOrderUnitPrice(availInfoMap.get(availId), unit, size);
  }

  // Build the canonical line shape for incoming items. Persist the
  // (unit, size, color, variety) discriminators so chefs can order multiple
  // sizes/colors/varieties of the same item and have them round-trip through
  // the receiver dashboard, email, and edit-order hydration.
  const incomingLines = items
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const info = availInfoMap.get(item.availability_item_id);
      const chosenUnit =
        (item.unit_type ?? null) || info?.firstUnit || null;
      // Only 'events' is persisted as a discriminator; Regular and Press Bar
      // lines store NULL (Press Bar never collides with the others).
      const menuSection = item.menu_section === "events" ? "events" : null;
      return {
        availability_item_id: item.availability_item_id,
        quantity_requested: item.quantity,
        unit_price_at_order: resolvePrice(item.availability_item_id, chosenUnit, item.size_label ?? null),
        unit_type: chosenUnit,
        size_label: item.size_label ?? null,
        color_key: item.color_key ?? null,
        variety_key: item.variety_key ?? null,
        menu_section: menuSection,
        // Accountability: who added this line. Stamped on every insert.
        created_by: user.id,
      };
    });

  // Track items used for the email summary. In merge mode this is just the
  // new lines (the chef only needs to see what they just submitted).
  let orderItems = incomingLines;

  // Merge-only counts surfaced in the audit detail (cheap to compute here).
  let mergeAdded = 0;
  let mergeBumped = 0;

  // Plan the writes, then apply them ATOMICALLY via the submit_order_with_items
  // RPC (migration 066). Previously the order upsert and the item writes were
  // separate statements — a failure between them left the order updated with
  // stale/empty items, and an admin "Finish & Send" racing this request could
  // be overwritten. The function re-checks the chef-editable statuses inside
  // the transaction and raises ORDER_LOCKED if the order moved on.
  let linesToInsert: typeof incomingLines = incomingLines;
  let linesToUpdate: { id: string; quantity_requested: number }[] = [];

  if (isMerge) {
    // Merge: sum qty into matching existing lines (same availId+unit+size+
    // color+variety); anything unmatched is appended. Existing untouched
    // lines stay put.
    // (planOrderItemMerge is the unit-tested core — see src/lib/orders.ts.)
    const { data: existingItems } = await (supabase.from("order_items") as any)
      .select("id, availability_item_id, unit_type, size_label, color_key, variety_key, menu_section, quantity_requested")
      .eq("order_id", existingOrder!.id);

    const { toInsert, toUpdate } = planOrderItemMerge(existingItems ?? [], incomingLines);
    linesToInsert = toInsert;
    linesToUpdate = toUpdate;
    mergeAdded = toInsert.length;
    mergeBumped = toUpdate.length;
  }

  const { data: orderId, error: submitError } = await (supabase as any).rpc(
    "submit_order_with_items",
    {
      p_restaurant_id: restaurant_id,
      p_delivery_date: delivery_date,
      p_freeform_notes: mergedNotes,
      // chef_id: creator on a new order; the function preserves the stored
      // value on conflict, so re-supplying the existing chef_id is just to
      // satisfy NOT NULL on the candidate insert tuple.
      p_chef_id: isNewOrder ? user.id : (existingOrder.chef_id ?? user.id),
      p_last_edited_by: user.id,
      p_replace: !isMerge,
      p_lines: linesToInsert,
      p_update_lines: linesToUpdate,
      p_idempotency_key: idempotency_key ?? null,
    },
  );

  if (submitError || !orderId) {
    const msg = String(submitError?.message ?? "");
    if (msg.includes("ORDER_LOCKED")) {
      return NextResponse.json(
        { error: "This order has already moved past editing — contact Press Farm to make changes." },
        { status: 409 },
      );
    }
    // The date was closed between the route's pre-check and the write
    // (concurrent admin close). Same response as the pre-check above.
    if (msg.includes("ORDERING_CLOSED")) {
      return NextResponse.json(
        { error: "Ordering is closed for this delivery date" },
        { status: 409 },
      );
    }
    console.error("Order submit RPC error:", submitError);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }
  const order = { id: orderId as string };

  // Actor name snapshot — fetched once, reused for the audit row AND the email
  // summaries below so we don't double-query profiles.
  const { data: actorProfile } = await (supabase.from("profiles") as any)
    .select("full_name")
    .eq("id", user.id)
    .single();
  const actorName: string | null = actorProfile?.full_name ?? null;

  // Audit trail — non-blocking. 'submitted' = brand-new order, 'edited' =
  // explicit edit (replace mode), 'merged' = follow-up submission appended to
  // an existing order. detail carries cheap counts for the timeline UIs.
  const auditAction = isNewOrder ? "submitted" : isMerge ? "merged" : "edited";
  const auditDetail: Record<string, unknown> = {
    delivery_date,
    item_count: incomingLines.length,
  };
  if (isMerge) {
    auditDetail.added = mergeAdded;
    auditDetail.bumped = mergeBumped;
  }
  await recordOrderAudit(supabase, {
    orderId: order.id,
    restaurantId: restaurant_id,
    deliveryDate: delivery_date,
    actorId: user.id,
    actorName,
    action: auditAction,
    detail: auditDetail,
  });

  // Send email notifications — non-blocking, errors do not fail the response.
  // Two emails fire: one to admin (OrderReceived) and one to chef (OrderConfirmation).
  try {
    const { data: restaurant } = await (supabase.from("restaurants") as any)
      .select("name")
      .eq("id", restaurant_id)
      .single();

    const chefProfile = { full_name: actorName };

    // Fetch item details for ordered items. Note: items.unit_type (not items.unit
    // — that column doesn't exist; the previous query was silently returning
    // undefined and the email rendered "Unknown item" with no unit).
    const orderedAvailIds = orderItems.map((oi) => oi.availability_item_id);
    const { data: availDetails } = orderedAvailIds.length > 0
      ? await (supabase.from("availability_items") as any)
          .select("id, item:items(name, unit_type)")
          .in("id", orderedAvailIds)
      : { data: [] };

    const availMap = new Map(
      (availDetails ?? []).map((a: any) => [a.id, a.item])
    );

    const emailItems = orderItems.map((oi) => {
      const item = availMap.get(oi.availability_item_id) as any;
      // unit_type may be comma-separated (e.g. "sm,lg") — surface the first
      // for the email line. The actual ordered unit is stored on the line
      // item itself (via the OrderForm's enumerateKeys flow).
      const unitFirst = String(item?.unit_type ?? "").split(",")[0]?.trim() ?? "";
      const baseName = item?.name ?? "Unknown item";
      return {
        itemName: (oi as any).menu_section === "events" ? `${baseName} (Events)` : baseName,
        quantity: oi.quantity_requested,
        unit: unitFirst,
      };
    });

    // 1. Admin notification
    await sendOrderSubmittedEmail({
      restaurantName: restaurant?.name ?? "Unknown restaurant",
      chefName: chefProfile?.full_name ?? "Chef",
      deliveryDate: delivery_date,
      items: emailItems,
      freeformNotes: freeform_notes,
      submittedAt: new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
    });

    // 2. Chef confirmation — only if we can resolve their email
    if (user.email) {
      await sendOrderConfirmationEmail({
        toEmail: user.email,
        chefName: chefProfile?.full_name ?? "Chef",
        restaurantName: restaurant?.name ?? "your restaurant",
        deliveryDate: delivery_date,
        items: emailItems,
        freeformNotes: freeform_notes,
      });
    }
  } catch (emailErr) {
    console.error("[EMAIL] Failed to send order submit/confirmation emails:", emailErr);
  }

  return NextResponse.json({ data: { orderId: order.id }, error: null }, { status: 200 });
}
