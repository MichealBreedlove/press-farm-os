const VALID_UNITS = new Set(["ea", "sm", "lg", "lbs", "bu", "qt", "bx", "cs", "pt", "kit", "gb"]);

/**
 * For every resolved order_item on this delivery_date, ensure a matching
 * delivery_items row exists so financial reports pick up revenue
 * automatically. Returns the count of rows created.
 *
 * "Resolved" means picked, shorted, OR belonging to an order that is
 * already 'fulfilled' — a fulfilled order delivers every non-shorted line
 * in full even if admin never tapped it as picked (the Mark Fulfilled
 * button auto-fills quantity_fulfilled the same way). Without that third
 * case, closing a day via Mark Fulfilled instead of Send to Receiver left
 * the whole date invisible to the finance system (Jul–Aug 2026 gap,
 * backfilled by migration 074).
 *
 * Shared by POST /api/orders/send-to-receiver and the fulfilled transition
 * of PATCH /api/orders/[orderId], so BOTH close-out paths write the
 * financial paper trail. Idempotent — safe to call multiple times.
 *
 * Skips:
 *   • order_items that are unresolved (admin hasn't decided them yet —
 *     counting them would silently over-report)
 *   • deliveries already in 'finalized' status (receiver locked them)
 *   • (delivery_id, item_id, unit, size) combos already in delivery_items
 */
export async function materializeDeliveryItems(admin: any, date: string): Promise<number> {
  // Pull all order_items for the date along with their item + order
  // context. Items missing a price fall back to items.default_price; null
  // prices ultimately get stored as 0 and the admin can correct via the
  // receiver edit flow before close-out.
  const { data: orders } = await admin
    .from("orders")
    .select(`
      id, restaurant_id, delivery_date, status,
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

  // Orders that actually have resolved lines — only these need a
  // deliveries row. Cancelled/draft orders never materialize.
  const ordersWithResolved = (orders as any[])
    .filter((order) => order.status !== "cancelled" && order.status !== "draft")
    .map((order) => ({
      order,
      restaurantId: order.restaurant_id as string,
      resolvedLines: (order.order_items ?? []).filter(
        (oi: any) => oi.picked_at || oi.is_shorted || order.status === "fulfilled",
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
      console.error("[materialize-deliveries] failed to create delivery rows:", delErr);
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
  // Rows pending insert this batch, keyed per delivery — kept OUTSIDE the
  // order loop so lines from different orders on the same delivery (Events
  // allows several orders per date) can still merge quantities.
  const pendingByDelivery = new Map<string, Map<string, any>>();

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

    // Build the rows to insert, deduped against (item_id, unit, size).
    // Intra-batch, lines sharing a key MERGE their quantities when the
    // price matches — e.g. two varieties of the same item+unit+size are
    // distinct order lines (variety_key is part of line identity) but one
    // delivery row. First-wins here used to silently drop the second
    // variety's quantity from the financial paper trail.
    const rowsToInsert: any[] = [];
    let pendingRowByKey = pendingByDelivery.get(delivery.id);
    if (!pendingRowByKey) {
      pendingRowByKey = new Map<string, any>();
      pendingByDelivery.set(delivery.id, pendingRowByKey);
    }
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

      // A row already in the DB covers this key — skip (receiver may have
      // corrected it; never overwrite). A row pending in THIS batch merges
      // its quantity when the price matches, else first-wins as before.
      if (existingKeys.has(key)) {
        const pending = pendingRowByKey.get(key);
        if (pending && Number(pending.unit_price) === unitPrice) {
          pending.quantity = Number(pending.quantity) + qty;
        }
        continue;
      }

      const row = {
        delivery_id: delivery.id,
        item_id: item.id,
        quantity: qty,
        unit: lineUnit,
        size_label: sizeLabel,
        unit_price: unitPrice,
      };
      rowsToInsert.push(row);
      pendingRowByKey.set(key, row);
      existingKeys.add(key); // prevent intra-loop duplicates from multi-unit/size items
    }

    allRowsToInsert.push(...rowsToInsert);
  }

  if (allRowsToInsert.length > 0) {
    const { error: insertErr } = await admin
      .from("delivery_items")
      .insert(allRowsToInsert);
    if (insertErr) {
      console.error("[materialize-deliveries] delivery_items insert failed:", insertErr);
    } else {
      createdCount = allRowsToInsert.length;
    }
  }

  return createdCount;
}
