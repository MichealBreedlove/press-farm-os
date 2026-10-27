import { resolveOrderUnitPrice } from "@/lib/pricing";

const VALID_UNITS = new Set(["ea", "sm", "lg", "lbs", "bu", "qt", "bx", "cs", "pt", "kit", "gb"]);

// ---------------------------------------------------------------------------
// Pure planning — no DB access. Everything that decides WHICH delivery_items
// rows get written lives here so it can be unit-tested with fixtures
// (tests/lib/materialize-deliveries.test.ts). The async wrapper below only
// fetches, calls planDeliveryRows, and writes.
// ---------------------------------------------------------------------------

/** The catalog item behind an order line (items.*). */
export interface MaterializeItem {
  id: string;
  name?: string | null;
  /** Comma-separated unit list, e.g. "sm,lg". First entry is the fallback unit. */
  unit_type?: string | null;
  default_price?: number | string | null;
  unit_prices?: Record<string, number> | null;
  size_prices?: Record<string, number> | null;
}

/** One order_items row with its item joined through availability_items. */
export interface MaterializeOrderLine {
  id: string;
  quantity_requested?: number | string | null;
  quantity_fulfilled?: number | string | null;
  is_shorted?: boolean | null;
  unit_type?: string | null;
  size_label?: string | null;
  unit_price_at_order?: number | string | null;
  picked_at?: string | null;
  availability_item?: { item?: MaterializeItem | null } | null;
}

export interface MaterializeOrder {
  id: string;
  restaurant_id: string;
  status: string;
  order_items?: MaterializeOrderLine[] | null;
}

export interface ExistingDelivery {
  id: string;
  restaurant_id: string;
  status: string;
}

export interface ExistingDeliveryItem {
  delivery_id: string;
  item_id: string;
  unit: string | null;
  size_label: string | null;
}

/** A deliveries row to create (one per restaurant that has resolved lines but no delivery yet). */
export interface DeliveryToCreate {
  delivery_date: string;
  restaurant_id: string;
  status: "logged";
}

/**
 * A delivery_items row to insert. `delivery_id` is null when the delivery
 * for `restaurant_id` is in `deliveriesToCreate` and doesn't have an id yet —
 * the wrapper fills it in after creating the delivery.
 */
export interface PlannedDeliveryRow {
  restaurant_id: string;
  delivery_id: string | null;
  item_id: string;
  quantity: number;
  unit: string;
  size_label: string | null;
  unit_price: number;
}

export type SkipReason =
  | "order_not_open" // cancelled / draft order
  | "unresolved" // admin hasn't picked / shorted it and the order isn't fulfilled
  | "finalized_delivery" // receiver locked the delivery
  | "no_item" // join to items missing
  | "invalid_unit"
  | "legacy_sizeless_row" // a size-less row already covers this item+unit
  | "zero_quantity"
  | "already_in_db" // (delivery, item, unit, size) row exists — never overwrite
  | "merged" // folded into a pending row of this batch (same key, same price)
  | "price_mismatch_first_wins"; // same key pending at a different price — dropped

export interface SkippedLine {
  orderId: string;
  orderItemId: string;
  reason: SkipReason;
}

export interface DeliveryPlan {
  deliveriesToCreate: DeliveryToCreate[];
  rowsToInsert: PlannedDeliveryRow[];
  skipped: SkippedLine[];
}

export interface PlanDeliveryRowsInput {
  date: string;
  orders: MaterializeOrder[];
  existingDeliveries: ExistingDelivery[];
  existingDeliveryItems: ExistingDeliveryItem[];
  /**
   * Orders to treat as 'fulfilled' even though the DB row still says
   * otherwise. PATCH /api/orders/[orderId] materializes BEFORE flipping the
   * status (so a failed write never leaves a fulfilled order with no paper
   * trail), and passes the order being fulfilled here.
   */
  assumeFulfilledOrderIds?: Iterable<string>;
}

const dedupKey = (itemId: string, unit: string, size: string | null | undefined) =>
  `${itemId}|${(unit ?? "").toLowerCase()}|${(size ?? "").trim().toLowerCase()}`;
const groupKey = (itemId: string, unit: string) => `${itemId}|${(unit ?? "").toLowerCase()}`;

/** Price for a line: the price frozen at order time, else the catalog tiers. */
function linePrice(line: MaterializeOrderLine, item: MaterializeItem, unit: string, size: string | null): number {
  if (line.unit_price_at_order != null) return Number(line.unit_price_at_order);
  // The catalog keys unit_prices by lowercase unit code ("lg", "gb"), and
  // resolveOrderUnitPrice looks the unit up verbatim — so the unit is
  // normalized to lowercase before this call (see the "LG" vs "lg" test).
  return resolveOrderUnitPrice(
    {
      unitPrices: item.unit_prices ?? {},
      defaultPrice: item.default_price == null ? null : Number(item.default_price),
      sizePrices: item.size_prices ?? null,
    },
    unit,
    size,
  );
}

/**
 * Decide which delivery_items rows the resolved order lines on `date` need.
 *
 * Rules (each pinned by a test):
 *   • a line is resolved when it's picked, shorted, or its order is fulfilled
 *     (or listed in assumeFulfilledOrderIds); cancelled/draft orders never count
 *   • quantity = quantity_fulfilled for shorted lines, else quantity_requested;
 *     qty <= 0 is skipped
 *   • unit = the line's unit (lowercased), else the item's first unit, else
 *     "ea"; anything outside VALID_UNITS is skipped
 *   • price = unit_price_at_order, else size_prices[size] → unit_prices[unit]
 *     → default_price → 0 (resolveOrderUnitPrice)
 *   • a delivery in 'finalized' status is never touched
 *   • a legacy size-less row for an item+unit suppresses every SIZED line of
 *     that item+unit (pre-per-size rows would otherwise be double-counted)
 *   • a (delivery, item, unit, size) row already in the DB is never rewritten
 *   • within this batch, lines sharing a key merge their quantities only when
 *     the price matches; otherwise the first line wins
 */
export function planDeliveryRows(input: PlanDeliveryRowsInput): DeliveryPlan {
  const { date, orders, existingDeliveries, existingDeliveryItems } = input;
  const assumeFulfilled = new Set(input.assumeFulfilledOrderIds ?? []);
  const skipped: SkippedLine[] = [];

  const deliveryByRestaurant = new Map<string, ExistingDelivery>();
  for (const d of existingDeliveries) deliveryByRestaurant.set(d.restaurant_id, d);

  // Existing rows: exact keys per delivery + item+unit groups that already
  // have a size-less row.
  const existingKeysByDelivery = new Map<string, Set<string>>();
  const sizelessGroupByDelivery = new Map<string, Set<string>>();
  for (const l of existingDeliveryItems) {
    let set = existingKeysByDelivery.get(l.delivery_id);
    if (!set) {
      set = new Set<string>();
      existingKeysByDelivery.set(l.delivery_id, set);
    }
    set.add(dedupKey(l.item_id, l.unit ?? "", l.size_label));
    if ((l.size_label ?? "").trim() === "") {
      let g = sizelessGroupByDelivery.get(l.delivery_id);
      if (!g) {
        g = new Set<string>();
        sizelessGroupByDelivery.set(l.delivery_id, g);
      }
      g.add(groupKey(l.item_id, l.unit ?? ""));
    }
  }

  // Resolved lines per order.
  const ordersWithResolved: Array<{ order: MaterializeOrder; lines: MaterializeOrderLine[] }> = [];
  for (const order of orders) {
    const lines = order.order_items ?? [];
    if (order.status === "cancelled" || order.status === "draft") {
      for (const oi of lines) skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "order_not_open" });
      continue;
    }
    const fulfilled = order.status === "fulfilled" || assumeFulfilled.has(order.id);
    const resolved: MaterializeOrderLine[] = [];
    for (const oi of lines) {
      if (oi.picked_at || oi.is_shorted || fulfilled) resolved.push(oi);
      else skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "unresolved" });
    }
    if (resolved.length > 0) ordersWithResolved.push({ order, lines: resolved });
  }

  // Deliveries to create: one per restaurant with resolved lines and no row.
  const deliveriesToCreate: DeliveryToCreate[] = [];
  const seenMissing = new Set<string>();
  for (const { order } of ordersWithResolved) {
    const rid = order.restaurant_id;
    if (deliveryByRestaurant.has(rid) || seenMissing.has(rid)) continue;
    seenMissing.add(rid);
    deliveriesToCreate.push({ delivery_date: date, restaurant_id: rid, status: "logged" });
  }

  // Pending rows per restaurant (a delivery is one per restaurant per date).
  // Kept across orders so lines from different orders on the same delivery
  // (Events allows several orders per date) can still merge.
  const rowsToInsert: PlannedDeliveryRow[] = [];
  const pendingByRestaurant = new Map<string, Map<string, PlannedDeliveryRow>>();
  const batchKeysByRestaurant = new Map<string, Set<string>>();

  for (const { order, lines } of ordersWithResolved) {
    const rid = order.restaurant_id;
    const delivery = deliveryByRestaurant.get(rid) ?? null;
    if (delivery?.status === "finalized") {
      for (const oi of lines) skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "finalized_delivery" });
      continue;
    }
    const existingKeys = delivery ? existingKeysByDelivery.get(delivery.id) ?? new Set<string>() : new Set<string>();
    const sizelessGroups = delivery ? sizelessGroupByDelivery.get(delivery.id) ?? new Set<string>() : new Set<string>();
    let pending = pendingByRestaurant.get(rid);
    if (!pending) {
      pending = new Map();
      pendingByRestaurant.set(rid, pending);
    }
    let batchKeys = batchKeysByRestaurant.get(rid);
    if (!batchKeys) {
      batchKeys = new Set();
      batchKeysByRestaurant.set(rid, batchKeys);
    }

    for (const oi of lines) {
      const item = oi.availability_item?.item;
      if (!item) {
        skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "no_item" });
        continue;
      }

      const lineUnit =
        (oi.unit_type ?? "").trim().toLowerCase() ||
        (String(item.unit_type ?? "")
          .split(",")
          .map((u) => u.trim().toLowerCase())
          .filter(Boolean)[0] ?? "ea");
      if (!VALID_UNITS.has(lineUnit)) {
        skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "invalid_unit" });
        continue;
      }

      const sizeLabel: string | null = oi.size_label ?? null;
      if ((sizeLabel ?? "").trim() !== "" && sizelessGroups.has(groupKey(item.id, lineUnit))) {
        skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "legacy_sizeless_row" });
        continue;
      }
      const key = dedupKey(item.id, lineUnit, sizeLabel);

      const qty = oi.is_shorted ? Number(oi.quantity_fulfilled ?? 0) : Number(oi.quantity_requested ?? 0);
      if (!(qty > 0)) {
        skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "zero_quantity" });
        continue;
      }

      const unitPrice = linePrice(oi, item, lineUnit, sizeLabel);

      if (existingKeys.has(key)) {
        skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "already_in_db" });
        continue;
      }
      if (batchKeys.has(key)) {
        const row = pending.get(key);
        if (row && row.unit_price === unitPrice) {
          row.quantity += qty;
          skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "merged" });
        } else {
          skipped.push({ orderId: order.id, orderItemId: oi.id, reason: "price_mismatch_first_wins" });
        }
        continue;
      }

      const row: PlannedDeliveryRow = {
        restaurant_id: rid,
        delivery_id: delivery?.id ?? null,
        item_id: item.id,
        quantity: qty,
        unit: lineUnit,
        size_label: sizeLabel,
        unit_price: unitPrice,
      };
      rowsToInsert.push(row);
      pending.set(key, row);
      batchKeys.add(key);
    }
  }

  return { deliveriesToCreate, rowsToInsert, skipped };
}

// ---------------------------------------------------------------------------
// DB wrapper
// ---------------------------------------------------------------------------

export interface MaterializeResult {
  /** delivery_items rows written. */
  created: number;
  /** True when ANY read or write failed — nothing was partially trusted. */
  failed: boolean;
  /** Short internal detail for logs (never shown verbatim to a client). */
  error?: string;
  /** Data-shape skips worth surfacing to the admin (unit / legacy-row problems). */
  warning?: string;
}

/** Skip reasons that signal a data problem rather than normal dedupe. */
const WARN_REASONS: ReadonlySet<SkipReason> = new Set([
  "invalid_unit",
  "legacy_sizeless_row",
  "price_mismatch_first_wins",
  "no_item",
]);

/** Human summary of the notable skips, or undefined when there were none. */
export function summarizeSkips(skipped: SkippedLine[]): string | undefined {
  const counts = new Map<SkipReason, number>();
  for (const s of skipped) {
    if (WARN_REASONS.has(s.reason)) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  }
  if (counts.size === 0) return undefined;
  const label: Record<string, string> = {
    invalid_unit: "unrecognized unit",
    legacy_sizeless_row: "already covered by an older size-less delivery row",
    price_mismatch_first_wins: "same item at a different price (first kept)",
    no_item: "missing catalog item",
  };
  return (
    "Some lines were not written to the delivery log: " +
    Array.from(counts.entries())
      .map(([r, n]) => `${n} ${label[r] ?? r}`)
      .join(", ") +
    "."
  );
}

/**
 * For every resolved order_item on this delivery_date, ensure a matching
 * delivery_items row exists so financial reports pick up revenue
 * automatically.
 *
 * "Resolved" means picked, shorted, OR belonging to an order that is
 * already 'fulfilled' — a fulfilled order delivers every non-shorted line
 * in full even if admin never tapped it as picked (the Mark Fulfilled
 * button auto-fills quantity_fulfilled the same way). Without that third
 * case, closing a day via Mark Fulfilled instead of Send to Receiver left
 * the whole date invisible to the finance system (Jul–Aug 2026 gap,
 * backfilled by migration 076).
 *
 * Shared by POST /api/orders/send-to-receiver and the fulfilled transition
 * of PATCH /api/orders/[orderId], so BOTH close-out paths write the
 * financial paper trail. Idempotent — safe to call multiple times.
 *
 * Never throws for a DB problem and never swallows one either: every read
 * or write error comes back as `{ failed: true, error }` so the caller can
 * refuse to close the order/day. (Pre-2026-10-27 this logged and returned
 * 0, and the callers had already flipped the status — review §1.4.)
 */
export async function materializeDeliveryItems(
  admin: any,
  date: string,
  opts: { assumeFulfilledOrderIds?: Iterable<string> } = {},
): Promise<MaterializeResult> {
  const fail = (step: string, err: unknown): MaterializeResult => {
    const detail = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    console.error(`[materialize-deliveries] ${step} failed for ${date}:`, err);
    return { created: 0, failed: true, error: `${step}: ${detail}` };
  };

  // Pull all order_items for the date along with their item + order
  // context. Items missing a price fall back to items.default_price; null
  // prices ultimately get stored as 0 and the admin can correct via the
  // receiver edit flow before close-out.
  const { data: orders, error: ordersErr } = await admin
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
  if (ordersErr) return fail("orders read", ordersErr);
  if (!orders || orders.length === 0) return { created: 0, failed: false };

  const { data: existingDeliveries, error: delReadErr } = await admin
    .from("deliveries")
    .select("id, restaurant_id, status")
    .eq("delivery_date", date);
  if (delReadErr) return fail("deliveries read", delReadErr);
  const deliveries = (existingDeliveries ?? []) as ExistingDelivery[];

  // Existing lines for every delivery on the date (new deliveries have none).
  let existingLines: ExistingDeliveryItem[] = [];
  if (deliveries.length > 0) {
    const { data, error } = await admin
      .from("delivery_items")
      .select("delivery_id, item_id, unit, size_label")
      .in(
        "delivery_id",
        deliveries.map((d) => d.id),
      );
    if (error) return fail("delivery_items read", error);
    existingLines = (data ?? []) as ExistingDeliveryItem[];
  }

  const plan = planDeliveryRows({
    date,
    orders: orders as MaterializeOrder[],
    existingDeliveries: deliveries,
    existingDeliveryItems: existingLines,
    assumeFulfilledOrderIds: opts.assumeFulfilledOrderIds,
  });
  const warning = summarizeSkips(plan.skipped);

  // Batch-create any missing deliveries rows in one insert and fill their
  // ids into the planned rows.
  if (plan.deliveriesToCreate.length > 0) {
    const { data: newDeliveries, error: delErr } = await admin
      .from("deliveries")
      .insert(plan.deliveriesToCreate)
      .select("id, restaurant_id, status");
    if (delErr) return fail("deliveries insert", delErr);
    const idByRestaurant = new Map<string, string>();
    for (const d of (newDeliveries ?? []) as ExistingDelivery[]) idByRestaurant.set(d.restaurant_id, d.id);
    for (const row of plan.rowsToInsert) {
      if (row.delivery_id == null) row.delivery_id = idByRestaurant.get(row.restaurant_id) ?? null;
    }
    const orphan = plan.rowsToInsert.find((r) => r.delivery_id == null);
    if (orphan) return fail("deliveries insert", `no delivery row came back for restaurant ${orphan.restaurant_id}`);
  }

  if (plan.rowsToInsert.length === 0) return { created: 0, failed: false, warning };

  const payload = plan.rowsToInsert.map(({ restaurant_id: _rid, ...row }) => row);
  const { error: insertErr } = await admin.from("delivery_items").insert(payload);
  if (insertErr) return fail("delivery_items insert", insertErr);

  return { created: payload.length, failed: false, warning };
}
