import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatQty, formatDeliveryDate } from "@/lib/utils";
import {
  PERIOD_KEYS,
  PERIOD_LABELS,
  parsePeriod,
  rangeLabel,
  resolvePeriod,
} from "@/lib/orders-explorer";
import type { PeriodKey } from "@/lib/orders-explorer";

interface ItemRollup {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  orderIds: Set<string>; // distinct orders the item appeared on
  qtyOrdered: number; // sum of quantity_requested
  qtyDelivered: number; // sum of delivered quantity ("brought in")
  deliveryLines: number;
  revenue: number;
}

interface OrderRow {
  orderId: string;
  date: string;
  restaurant: string;
  status: string;
  lines: { name: string; qty: number; unit: string }[];
}


export type ExplorerSearchParams = {
  period?: string | string[];
  restaurant?: string | string[];
  q?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

/**
 * "Explore" view of /admin/orders — cross-period analytics that answers two
 * questions Micheal asks during use:
 *   1. "What was ordered on these dates?" — an order browser filtered by
 *      period + restaurant.
 *   2. "How many times was X ordered / how many X did I bring in?" — per-item
 *      rollup combining orders (times ordered, qty requested) with deliveries
 *      (qty brought in, revenue). Deliveries are the source of truth for what
 *      actually shipped; orders show demand.
 *
 * Item search is a name fragment so varieties group naturally (e.g. "nasturtium"
 * → Nasturtium + Capers + Flowers; "peach" → Peach blossom + Peaches).
 *
 * Server component; the caller (orders/page.tsx) has already gated auth.
 */
export async function ExplorerView({ searchParams }: { searchParams: ExplorerSearchParams }) {
  const sp = searchParams;
  // searchParams values can be string | string[] (repeated keys) — always
  // take the first so downstream string ops (.trim, comparisons) are safe.
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const period: PeriodKey = parsePeriod(first(sp.period));

  const { from, to } = resolvePeriod(period, first(sp.from), first(sp.to));
  const restaurantRaw = first(sp.restaurant);
  const restaurantFilter = restaurantRaw && restaurantRaw !== "all" ? restaurantRaw : null;
  const query = (first(sp.q) ?? "").trim();
  const queryLower = query.toLowerCase();

  const admin = createAdminClient();

  // Restaurants for the filter dropdown.
  const { data: restaurantsRaw } = await admin
    .from("restaurants")
    .select("id, name")
    .order("name", { ascending: true });
  const restaurants: { id: string; name: string }[] = restaurantsRaw ?? [];

  // Deliveries in window — what was actually brought in (source of truth).
  let deliveryQuery = admin
    .from("delivery_items")
    .select(
      `
      quantity, unit, unit_price, line_total,
      items ( id, name, category, unit_type ),
      deliveries!inner ( delivery_date, restaurant_id, restaurants ( name ) )
    `,
    )
    .gte("deliveries.delivery_date", from)
    .lte("deliveries.delivery_date", to);
  if (restaurantFilter) deliveryQuery = deliveryQuery.eq("deliveries.restaurant_id", restaurantFilter);

  // Orders in window — demand. order_items → availability_items → items.
  let orderQuery = admin
    .from("order_items")
    .select(
      `
      quantity_requested, unit_type,
      availability_items ( items ( id, name, category, unit_type ) ),
      orders!inner ( id, delivery_date, restaurant_id, status, restaurants ( name ) )
    `,
    )
    .gte("orders.delivery_date", from)
    .lte("orders.delivery_date", to);
  if (restaurantFilter) orderQuery = orderQuery.eq("orders.restaurant_id", restaurantFilter);

  const [{ data: deliveryItems }, { data: orderItems }] = await Promise.all([
    deliveryQuery,
    orderQuery,
  ]);

  // ---- Roll up per item ----
  const rollup = new Map<string, ItemRollup>();
  const ensure = (item: any): ItemRollup | null => {
    if (!item?.id) return null;
    const id = item.id as string;
    let r = rollup.get(id);
    if (!r) {
      r = {
        itemId: id,
        name: item.name,
        category: item.category,
        unit: item.unit_type ?? "",
        orderIds: new Set(),
        qtyOrdered: 0,
        qtyDelivered: 0,
        deliveryLines: 0,
        revenue: 0,
      };
      rollup.set(id, r);
    }
    return r;
  };

  for (const di of deliveryItems ?? []) {
    const r = ensure((di as any).items);
    if (!r) continue;
    const qty = Number((di as any).quantity ?? 0);
    const revenue = (di as any).line_total ?? qty * Number((di as any).unit_price ?? 0);
    r.qtyDelivered += qty;
    r.revenue += Number(revenue ?? 0);
    r.deliveryLines += 1;
    if ((di as any).unit) r.unit = (di as any).unit;
  }

  // ---- Orders browser + per-item demand ----
  const ordersMap = new Map<string, OrderRow>();
  for (const oi of orderItems ?? []) {
    const item = (oi as any).availability_items?.items;
    const order = (oi as any).orders;
    const r = ensure(item);
    if (r && order?.id) {
      r.orderIds.add(order.id);
      r.qtyOrdered += Number((oi as any).quantity_requested ?? 0);
    }
    if (order?.id) {
      let row = ordersMap.get(order.id);
      if (!row) {
        row = {
          orderId: order.id,
          date: order.delivery_date,
          restaurant: order.restaurants?.name ?? "—",
          status: order.status,
          lines: [],
        };
        ordersMap.set(order.id, row);
      }
      if (item?.name) {
        row.lines.push({
          name: item.name,
          qty: Number((oi as any).quantity_requested ?? 0),
          unit: (oi as any).unit_type ?? item.unit_type ?? "",
        });
      }
    }
  }

  const allItems = Array.from(rollup.values());
  const matchesFilter = (r: ItemRollup) =>
    !query || r.name.toLowerCase().includes(queryLower);
  const itemRows = allItems
    .filter(matchesFilter)
    .sort((a, b) => b.revenue - a.revenue || b.qtyDelivered - a.qtyDelivered);

  const orderRows = Array.from(ordersMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date) || a.restaurant.localeCompare(b.restaurant),
  );

  // ---- Headline totals (respect the item search when present) ----
  const totalsSource = query ? itemRows : allItems;
  const totalRevenue = totalsSource.reduce((s, r) => s + r.revenue, 0);
  const totalDelivered = totalsSource.reduce((s, r) => s + r.qtyDelivered, 0);
  const totalOrderedTimes = totalsSource.reduce((s, r) => s + r.orderIds.size, 0);
  const totalQtyOrdered = totalsSource.reduce((s, r) => s + r.qtyOrdered, 0);

  const restaurantValue = restaurantRaw ?? "all";

  const periodKeys = PERIOD_KEYS;

  return (
      <div className="px-4 py-5 space-y-6 max-w-3xl mx-auto">
        <p className="text-xs text-farm-muted -mb-3">{rangeLabel(from, to)}</p>
        {/* ---- Filters ---- */}
        <form method="get" action="/admin/orders" className="space-y-3">
          <input type="hidden" name="view" value="explore" />
          {/* Period chips — submit buttons. The restaurant select + search
              input live in this same form, so any submit carries them; no
              hidden duplicates (which produced array params that crashed). */}
          <div className="grid grid-cols-3 gap-1.5">
            {periodKeys.map((key) => (
              <button
                key={key}
                type="submit"
                name="period"
                value={key}
                className={`min-h-[40px] text-sm font-medium rounded-lg transition-colors ${
                  period === key
                    ? "bg-farm-green text-white shadow-sm"
                    : "bg-farm-cream/60 text-farm-muted hover:text-farm-dark/80"
                }`}
              >
                {PERIOD_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Restaurant + item search */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              name="restaurant"
              defaultValue={restaurantValue}
              className="input-field flex-1"
              aria-label="Restaurant"
            >
              <option value="all">All restaurants</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search item (e.g. nasturtium, peach)…"
              className="input-field flex-1"
              aria-label="Search item"
            />
            <button
              type="submit"
              name="period"
              value={period}
              className="btn-primary min-h-[44px] px-5"
            >
              Apply
            </button>
          </div>

          {/* Custom range */}
          <details className="card p-3" open={period === "custom"}>
            <summary className="text-xs font-medium text-farm-muted cursor-pointer">
              Custom date range
            </summary>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 mt-3">
              <label className="flex-1 text-xs text-farm-muted">
                From
                <input type="date" name="from" defaultValue={from} className="input-field mt-1" />
              </label>
              <label className="flex-1 text-xs text-farm-muted">
                To
                <input type="date" name="to" defaultValue={to} className="input-field mt-1" />
              </label>
              <button
                type="submit"
                name="period"
                value="custom"
                className="btn-secondary min-h-[44px] px-4"
              >
                Apply range
              </button>
            </div>
          </details>
        </form>

        {/* ---- Headline totals ---- */}
        <div>
          {query && (
            <p className="text-xs text-farm-muted mb-2">
              Matching <span className="font-semibold text-farm-dark">&ldquo;{query}&rdquo;</span>{" "}
              · {itemRows.length} {itemRows.length === 1 ? "item" : "items"} · {rangeLabel(from, to)}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-farm-dark">{totalOrderedTimes}</p>
              <p className="text-[10px] text-farm-muted mt-0.5">Times Ordered</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-farm-dark">{formatQty(totalQtyOrdered)}</p>
              <p className="text-[10px] text-farm-muted mt-0.5">Qty Ordered</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-farm-green">{formatQty(totalDelivered)}</p>
              <p className="text-[10px] text-farm-muted mt-0.5">Brought In</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-farm-dark">{formatCurrency(totalRevenue)}</p>
              <p className="text-[10px] text-farm-muted mt-0.5">Revenue</p>
            </div>
          </div>
        </div>

        {/* ---- Per-item table ---- */}
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-3">
            {query ? "Matching Items" : "Items in Window"}
          </p>
          <div className="card overflow-hidden">
            {itemRows.length === 0 ? (
              <p className="text-sm text-farm-muted text-center py-6">
                {query
                  ? `No items matching “${query}” were ordered or delivered in this window.`
                  : "Nothing ordered or delivered in this window."}
              </p>
            ) : (
              <>
                <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-gray-100 text-[10px] uppercase tracking-wide text-farm-muted">
                  <span>Item</span>
                  <span className="text-right">Ordered ×</span>
                  <span className="text-right">Qty Ord.</span>
                  <span className="text-right">Brought In</span>
                  <span className="text-right">Revenue</span>
                </div>
                {itemRows.map((r) => (
                  <Link
                    key={r.itemId}
                    href={`/admin/items/${r.itemId}`}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-farm-cream/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-farm-dark truncate">{r.name}</p>
                      <p className="text-[11px] text-farm-muted sm:hidden">
                        ordered {r.orderIds.size}× · {formatQty(r.qtyOrdered)} req · brought in{" "}
                        {formatQty(r.qtyDelivered)} {r.unit}
                      </p>
                    </div>
                    <span className="hidden sm:block text-sm text-right text-farm-dark">
                      {r.orderIds.size}
                    </span>
                    <span className="hidden sm:block text-sm text-right text-farm-dark">
                      {formatQty(r.qtyOrdered)}
                    </span>
                    <span className="hidden sm:block text-sm text-right text-farm-green font-medium">
                      {formatQty(r.qtyDelivered)}
                    </span>
                    <span className="text-sm text-right font-semibold text-farm-dark">
                      {formatCurrency(r.revenue)}
                    </span>
                  </Link>
                ))}
              </>
            )}
          </div>
          <p className="text-[11px] text-farm-muted mt-2 px-1">
            &ldquo;Ordered ×&rdquo; counts the orders an item appeared on. &ldquo;Brought In&rdquo; and Revenue
            come from logged deliveries — the source of truth for what actually shipped.
          </p>
        </section>

        {/* ---- Orders browser ---- */}
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-3">
            Orders Placed ({orderRows.length})
          </p>
          {orderRows.length === 0 ? (
            <div className="card p-4">
              <p className="text-sm text-farm-muted text-center py-2">
                No orders were placed in this window
                {restaurantFilter ? " for this restaurant" : ""}.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {orderRows.map((o) => (
                <details key={o.orderId} className="card overflow-hidden">
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-farm-dark truncate">{o.restaurant}</p>
                      <p className="text-xs text-farm-muted">{formatDeliveryDate(o.date)}</p>
                    </div>
                    <span className="text-xs text-farm-muted">
                      {o.lines.length} {o.lines.length === 1 ? "item" : "items"}
                    </span>
                    <span className="text-farm-muted/60 text-xs">▾</span>
                  </summary>
                  <div className="px-4 pb-3 border-t border-gray-50">
                    {o.lines.length === 0 ? (
                      <p className="text-xs text-farm-muted py-2">No line items.</p>
                    ) : (
                      <ul className="divide-y divide-gray-50">
                        {o.lines.map((l, i) => (
                          <li key={i} className="flex items-center justify-between py-2 text-sm">
                            <span className="text-farm-dark truncate pr-3">{l.name}</span>
                            <span className="text-farm-muted whitespace-nowrap">
                              {formatQty(l.qty)} {l.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={`/admin/orders/${o.date}`}
                      className="inline-block mt-2 text-xs text-farm-green font-medium"
                    >
                      Open order day →
                    </Link>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
  );
}
