import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReceiverBlocks, sendToReceivers } from "@/lib/receiver-notify";

const VALID_UNITS = new Set(["ea", "sm", "lg", "lbs", "bu", "qt", "bx", "cs", "pt", "kit", "gb"]);

/**
 * POST /api/orders/send-to-receiver
 *
 * One-shot "I'm done picking" action from the unified pick page. For
 * the given delivery date, this:
 *   1. Bumps every 'submitted' order to 'in_progress' so the receiver
 *      dashboard shows them as the day's queue.
 *   2. Auto-creates the financial paper trail — for each picked or
 *      shorted order_item that doesn't already have a matching
 *      delivery_items row, materialize one. The deliveries row is
 *      upserted on (date, restaurant). The deliveries.total_value
 *      trigger then auto-rolls up to the financial reports.
 *   3. Sends the receiver-daily email with the same template the cron
 *      uses.
 *
 * Idempotent — safe to call multiple times. Existing delivery_items
 * are not duplicated; existing rows aren't overwritten so the receiver
 * can correct quantities mid-day. Once the receiver closes out the
 * delivery (status = 'finalized'), this endpoint will skip the
 * auto-create for that delivery to preserve the audit trail.
 *
 * Admin-only. Body: { date: "YYYY-MM-DD" }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const date = (body.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Bump statuses. We only touch 'submitted' rows so re-sending after a
  // shortage edit doesn't undo a 'fulfilled' order — the receiver may
  // have already finished part of the day.
  const { error: statusErr, count: bumpedCount } = await admin
    .from("orders")
    .update({ status: "in_progress" }, { count: "exact" })
    .eq("delivery_date", date)
    .eq("status", "submitted");
  if (statusErr) {
    return NextResponse.json({ error: `Status update failed: ${statusErr.message}` }, { status: 500 });
  }

  // Auto-create delivery_items so the financial reports light up
  // without anyone visiting the legacy /admin/deliveries log page.
  const created = await materializeDeliveryItems(admin, date);

  // Build + send the receiver email. Falls back gracefully if no
  // active receivers exist — admin sees a clear message rather than
  // a silent no-op.
  const blocks = await buildReceiverBlocks(date);
  if (blocks.length === 0) {
    return NextResponse.json({
      ok: true,
      bumped: bumpedCount ?? 0,
      sent: 0,
      delivery_items_created: created,
      message: "No orders for this date — nothing to send.",
    });
  }

  const sendResults = await sendToReceivers(date, blocks);
  const successes = sendResults.filter((r) => r.status === "sent").length;
  const failures = sendResults.filter((r) => r.status !== "sent");

  return NextResponse.json({
    ok: true,
    bumped: bumpedCount ?? 0,
    sent: successes,
    failed: failures.length,
    delivery_items_created: created,
    failures: failures.map((f) => ({ to: f.receiver, error: String(f.error ?? f.status) })),
    receivers_count: sendResults.length,
  });
}

/**
 * For every picked/shorted order_item on this delivery_date, ensure a
 * matching delivery_items row exists so financial reports pick up
 * revenue automatically. Returns the count of rows created.
 *
 * Skips:
 *   • order_items that are neither picked nor shorted (admin hasn't
 *     resolved them yet — sending without resolving would silently
 *     under-report)
 *   • deliveries already in 'finalized' status (receiver locked them)
 *   • (delivery_id, item_id, unit) combos already in delivery_items
 */
async function materializeDeliveryItems(admin: any, date: string): Promise<number> {
  // Pull all order_items for the date that are resolved (picked OR shorted)
  // along with their item + order context. Items missing a price fall
  // back to items.default_price; null prices ultimately get stored as 0
  // and the admin can correct via the receiver edit flow before close-out.
  const { data: orders } = await admin
    .from("orders")
    .select(`
      id, restaurant_id, delivery_date,
      order_items(
        id, quantity_requested, quantity_fulfilled, is_shorted,
        unit_type, size_label, unit_price_at_order, picked_at,
        availability_item:availability_items(
          item:items(id, name, unit_type, default_price, unit_prices, size_prices)
        )
      )
    `)
    .eq("delivery_date", date);

  if (!orders || orders.length === 0) return 0;

  // Get existing deliveries for this date (id keyed by restaurant_id)
  // and track which are finalized so we don't touch them.
  const { data: existingDeliveries } = await admin
    .from("deliveries")
    .select("id, restaurant_id, status")
    .eq("delivery_date", date);
  const deliveryByRestaurant = new Map<string, { id: string; status: string }>();
  for (const d of (existingDeliveries ?? []) as Array<{ id: string; restaurant_id: string; status: string }>) {
    deliveryByRestaurant.set(d.restaurant_id, { id: d.id, status: d.status });
  }

  // Orders that actually have resolved (picked OR shorted) lines — only
  // these need a deliveries row.
  const ordersWithResolved = (orders as any[])
    .map((order) => ({
      order,
      restaurantId: order.restaurant_id as string,
      resolvedLines: (order.order_items ?? []).filter(
        (oi: any) => oi.picked_at || oi.is_shorted,
      ),
    }))
    .filter((o) => o.resolvedLines.length > 0);
  if (ordersWithResolved.length === 0) return 0;

  // Batch-create any missing deliveries rows in one insert (was one
  // round-trip per restaurant).
  const missingRestaurantIds = Array.from(
    new Set(
      ordersWithResolved
        .map((o) => o.restaurantId)
        .filter((rid) => !deliveryByRestaurant.has(rid)),
    ),
  );
  if (missingRestaurantIds.length > 0) {
    const { data: newDeliveries, error: delErr } = await admin
      .from("deliveries")
      .insert(
        missingRestaurantIds.map((rid) => ({
          delivery_date: date,
          restaurant_id: rid,
          status: "logged",
        })),
      )
      .select("id, restaurant_id, status");
    if (delErr) {
      console.error("[send-to-receiver] failed to create delivery rows:", delErr);
    }
    for (const d of (newDeliveries ?? []) as Array<{ id: string; restaurant_id: string; status: string }>) {
      deliveryByRestaurant.set(d.restaurant_id, { id: d.id, status: d.status });
    }
  }

  // Pull existing delivery_items for ALL relevant deliveries in one query
  // to dedupe (was one round-trip per delivery).
  const deliveryIds = ordersWithResolved
    .map((o) => deliveryByRestaurant.get(o.restaurantId)?.id)
    .filter(Boolean) as string[];
  // Dedup key includes size so different sizes of the same item+unit
  // (e.g. Nasturtium "Palm" vs "Dime - Nickel") each get their OWN
  // delivery_items row. Keying by item+unit alone collapsed them into one
  // row, which dropped the other sizes from the financial paper trail AND
  // made them read as "short" on the receiver dashboard.
  const dedupKey = (itemId: string, unit: string, size: string | null) =>
    `${itemId}|${(unit ?? "").toLowerCase()}|${(size ?? "").trim().toLowerCase()}`;
  const { data: existingLines } = deliveryIds.length > 0
    ? await admin
        .from("delivery_items")
        .select("delivery_id, item_id, unit, size_label")
        .in("delivery_id", deliveryIds)
    : { data: [] as any[] };
  const existingKeysByDelivery = new Map<string, Set<string>>();
  // Item+unit groups that already have a SIZE-LESS delivery row. Such rows
  // predate the per-size fix (the old code collapsed every size of an item+unit
  // into one size-less row). Their key won't match a sized line's key, so
  // without a guard a re-send would add per-size rows ALONGSIDE the legacy row
  // and double-count. We treat a size-less row as already covering that
  // item+unit and skip auto-materializing sized rows for it. (Items that have
  // no sizes at all also store a size-less row, but their order lines are
  // size-less too and dedupe exactly — so they're unaffected.)
  const sizelessGroupByDelivery = new Map<string, Set<string>>();
  const groupKey = (itemId: string, unit: string) => `${itemId}|${(unit ?? "").toLowerCase()}`;
  for (const l of (existingLines ?? []) as any[]) {
    let set = existingKeysByDelivery.get(l.delivery_id);
    if (!set) {
      set = new Set<string>();
      existingKeysByDelivery.set(l.delivery_id, set);
    }
    set.add(dedupKey(l.item_id, l.unit, l.size_label));
    if ((l.size_label ?? "").trim() === "") {
      let g = sizelessGroupByDelivery.get(l.delivery_id);
      if (!g) {
        g = new Set<string>();
        sizelessGroupByDelivery.set(l.delivery_id, g);
      }
      g.add(groupKey(l.item_id, l.unit));
    }
  }

  let createdCount = 0;
  const allRowsToInsert: any[] = [];

  for (const { restaurantId, resolvedLines } of ordersWithResolved) {
    const delivery = deliveryByRestaurant.get(restaurantId);
    if (!delivery) continue; // batch insert failed for this restaurant
    if (delivery.status === "finalized") continue;

    let existingKeys = existingKeysByDelivery.get(delivery.id);
    if (!existingKeys) {
      existingKeys = new Set<string>();
      existingKeysByDelivery.set(delivery.id, existingKeys);
    }
    const sizelessGroups = sizelessGroupByDelivery.get(delivery.id) ?? new Set<string>();

    // Build the rows to insert, deduped against (item_id, unit, size)
    const rowsToInsert: any[] = [];
    for (const oi of resolvedLines) {
      const item = oi.availability_item?.item;
      if (!item) continue;

      const lineUnit = (oi.unit_type ?? "").trim().toLowerCase() ||
        (String(item.unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean)[0] ?? "ea");
      if (!VALID_UNITS.has(lineUnit)) continue;

      const sizeLabel: string | null = oi.size_label ?? null;
      // Guard: a legacy size-less row already covers this item+unit. Skip the
      // sized line rather than create a duplicate that double-counts. (Size-less
      // lines fall through to the exact-key dedupe below.)
      if ((sizeLabel ?? "").trim() !== "" && sizelessGroups.has(groupKey(item.id, lineUnit))) continue;
      const key = dedupKey(item.id, lineUnit, sizeLabel);
      if (existingKeys.has(key)) continue;

      const qty = oi.is_shorted
        ? Number(oi.quantity_fulfilled ?? 0)
        : Number(oi.quantity_requested ?? 0);
      if (qty <= 0) continue;

      // Prefer the price stamped on the order line (locks the price as
      // of order time, even if the catalog changes later). Otherwise fall
      // back to the catalog price: size override for this size, then per-unit
      // override for the chosen unit, then the catalog default, then 0.
      const unitPricesMap = (item.unit_prices ?? {}) as Record<string, number>;
      const sizePricesMap = (item.size_prices ?? {}) as Record<string, number>;
      const sizeKey = (sizeLabel ?? "").trim();
      const fallbackPrice =
        (sizeKey && typeof sizePricesMap[sizeKey] === "number"
          ? sizePricesMap[sizeKey]
          : null) ??
        (typeof unitPricesMap[lineUnit] === "number"
          ? unitPricesMap[lineUnit]
          : null) ??
        Number(item.default_price ?? 0);
      const unitPrice = oi.unit_price_at_order != null
        ? Number(oi.unit_price_at_order)
        : fallbackPrice;

      rowsToInsert.push({
        delivery_id: delivery.id,
        item_id: item.id,
        quantity: qty,
        unit: lineUnit,
        size_label: sizeLabel,
        unit_price: unitPrice,
      });
      existingKeys.add(key); // prevent intra-loop duplicates from multi-unit/size items
    }

    allRowsToInsert.push(...rowsToInsert);
  }

  if (allRowsToInsert.length > 0) {
    const { error: insertErr } = await admin
      .from("delivery_items")
      .insert(allRowsToInsert);
    if (insertErr) {
      console.error("[send-to-receiver] delivery_items insert failed:", insertErr);
    } else {
      createdCount = allRowsToInsert.length;
    }
  }

  return createdCount;
}
