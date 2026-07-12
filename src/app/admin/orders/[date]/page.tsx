import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate, formatTimePacific, cn } from "@/lib/utils";
import { laneStyle } from "@/lib/lanes";
import { LaneBadge } from "@/components/shared/LaneBadge";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/constants";
import { FulfillButton } from "./FulfillButton";
import { DeleteOrderButton } from "./DeleteOrderButton";
import { InlineShortageRow } from "./InlineShortageRow";
import { AddExtraRow } from "./AddExtraRow";
import { ExtrasList } from "./ExtrasList";
import { HarvestGrid, type HarvestGridRow, type HarvestGridCategory, type HarvestGridContainer } from "./HarvestGrid";
import { PrintButton } from "./PrintButton";
import { SendToReceiverBar } from "./SendToReceiverBar";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusPill } from "@/components/shared/StatusPill";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { OrderActivity } from "@/components/shared/OrderActivity";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ItemCategory, OrderStatus, UnitType, OrderAudit } from "@/types";

interface AdminOrdersByDatePageProps {
  params: Promise<{ date: string }>;
}

/**
 * /admin/orders/[date] — Full order detail for a specific delivery date (server component)
 *
 * Shows all orders for the date, item-by-item, with shortage highlighting.
 */
export default async function AdminOrdersByDatePage({ params }: AdminOrdersByDatePageProps) {
  const { date } = await params;
  const supabase = await createClient();

  const admin = createAdminClient();

  // All five queries are independent of each other — run them in parallel
  // (this page is the daily pick-and-pack hot path; serially they cost
  // ~5 round-trips).
  const [
    { data: ordersRaw },
    { data: catalogRaw },
    { data: deliveriesRaw },
    { data: auditRaw },
    { count: activeReceiverCount },
  ] = await Promise.all([
    // Orders with full item detail
    (supabase as any)
      .from("orders")
      .select(`
        id, delivery_date, status, freeform_notes, submitted_at, last_edited_by, last_edited_at,
        event_date, event_name,
        restaurant:restaurants(id, name),
        chef:profiles!orders_chef_id_fkey(id, full_name),
        edited_by:profiles!orders_last_edited_by_fkey(id, full_name),
        order_items(
          id, quantity_requested, quantity_fulfilled, is_shorted, shortage_reason, unit_type, size_label, color_key, variety_key, menu_section, picked_at,
          replacement_item_id, replacement_label, replacement_quantity, replacement_unit,
          availability_item:availability_items(
            id,
            item:items(id, name, category, unit_type)
          )
        )
      `)
      .eq("delivery_date", date),
    // Catalog for the AddExtraRow picker — non-archived items, lightweight
    // columns only. Admin client so RLS doesn't filter by chef-restaurant linkage.
    (admin as any)
      .from("items")
      .select("id, name, category, unit_type, default_price, unit_prices")
      .eq("is_archived", false)
      .order("name"),
    // delivery_items for this date so we can surface "extras" admin has
    // already added during pick-and-pack. An extra is a delivery_item whose
    // item_id has no matching order_item on the same restaurant's order.
    (admin as any)
      .from("deliveries")
      .select(`
        id, restaurant_id, delivery_date,
        delivery_items (
          id, item_id, quantity, unit, unit_price, is_bonus,
          items ( id, name, unit_type )
        )
      `)
      .eq("delivery_date", date),
    // Activity timeline rows for every order on this date (admin client =
    // all restaurants). Grouped by order_id below for per-card rendering.
    (admin as any)
      .from("order_audit")
      .select("id, order_id, restaurant_id, delivery_date, actor_id, actor_name, action, detail, created_at")
      .eq("delivery_date", date)
      .order("created_at", { ascending: false }),
    // Active-receiver count — for the empty-state banner that surfaces the
    // gap BEFORE pick-and-pack (so admin can invite a receiver before
    // wasting time annotating shortages).
    (admin as any)
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "receiver")
      .eq("is_active", true),
  ]);

  const orders: any[] = ordersRaw ?? [];
  const catalogItems = catalogRaw ?? [];

  const auditByOrder = new Map<string, OrderAudit[]>();
  for (const row of (auditRaw ?? []) as OrderAudit[]) {
    if (!row.order_id) continue;
    const list = auditByOrder.get(row.order_id) ?? [];
    list.push(row);
    auditByOrder.set(row.order_id, list);
  }

  // Build a map: restaurant_id → list of "extras" (delivery_items not on the order)
  const extrasByRestaurant: Record<string, Array<{ id: string; itemName: string; quantity: number; unit: string }>> = {};
  for (const order of orders) {
    const orderedItemIds = new Set(
      (order.order_items ?? []).map((oi: any) => oi.availability_item?.item?.id).filter(Boolean),
    );
    const delivery = (deliveriesRaw ?? []).find((d: any) => d.restaurant_id === order.restaurant?.id);
    // An "extra" is a delivery line flagged is_bonus (the explicit signal set
    // by "Add Extra Item"). We also keep the legacy heuristic — a delivered
    // item that isn't on the chef's order — so extras added before is_bonus
    // was wired still surface. A bonus of an already-ordered item now shows
    // because is_bonus catches it (the heuristic alone never would).
    const extras = (delivery?.delivery_items ?? [])
      .filter((di: any) => di.items && (di.is_bonus || !orderedItemIds.has(di.items.id)))
      .map((di: any) => ({
        id: di.id,
        itemName: di.items.name,
        quantity: Number(di.quantity ?? 0),
        unit: String(di.unit ?? "").toUpperCase(),
      }));
    extrasByRestaurant[order.id] = extras;
  }

  // ── Combined harvest grid + pick progress ──
  // Roll up every order_item across every restaurant into (item, container)
  // buckets for the harvest grid at the top of the page — what to grab from
  // the field before the per-restaurant pack split. Per-restaurant
  // quantities become grid columns. Also count resolved lines (picked OR
  // shorted) so the sticky bottom bar shows real progress.

  // Restaurants that placed an order, in a stable harvester-friendly order
  // (Press → Understudy → Press Bar → others). These drive the grid columns.
  const harvestOrder = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower === "press") return 0;
    if (lower.includes("under")) return 1;
    if (lower.includes("bar")) return 2;
    if (lower.includes("event")) return 3;
    return 100;
  };
  const restaurantsInPlay: { id: string; name: string }[] = [];
  const seenRestaurantIds = new Set<string>();
  for (const o of orders) {
    const r = o.restaurant;
    if (!r?.id || seenRestaurantIds.has(r.id)) continue;
    seenRestaurantIds.add(r.id);
    restaurantsInPlay.push({ id: r.id, name: r.name });
  }
  restaurantsInPlay.sort((a, b) => {
    const oa = harvestOrder(a.name);
    const ob = harvestOrder(b.name);
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  // (item_id, container) → row with per-restaurant columns. Different
  // containers of the same crop become separate rows; regular + events lines
  // for the same crop sum together (you pick the combined total).
  type AggRow = HarvestGridRow & { category: ItemCategory };
  const itemMap = new Map<string, AggRow>();
  let totalLines = 0;
  let resolvedLines = 0;
  let submittedOrderCount = 0;
  for (const order of orders) {
    if (order.status === "submitted") submittedOrderCount += 1;
    const restaurantId = order.restaurant?.id;
    for (const oi of order.order_items ?? []) {
      const item = oi.availability_item?.item;
      if (!item) continue;
      totalLines += 1;
      // A line is "resolved" if the admin has either checked it off as
      // picked OR marked it as shorted. Both close the loop on that
      // line for receiver hand-off.
      if (oi.picked_at || oi.is_shorted) resolvedLines += 1;

      const lineUnit = ((oi.unit_type ?? "").trim().toLowerCase() ||
        (String(item.unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean)[0] ?? "ea")) as UnitType;
      const qty = oi.is_shorted ? Number(oi.quantity_fulfilled ?? 0) : Number(oi.quantity_requested ?? 0);
      if (qty <= 0 || !restaurantId) continue;

      // Specific variety/color the chef picked (e.g. "Genovese" basil,
      // "Chocolate" mint). Part of the harvest key so different varieties/
      // colors of the same crop stay on their own rows — you pick each one
      // separately.
      const colorKey = (oi.color_key ?? "").trim();
      const varietyKey = (oi.variety_key ?? "").trim();

      const key = `${item.id}|${lineUnit}|${colorKey}|${varietyKey}`;
      let row = itemMap.get(key);
      if (!row) {
        row = {
          itemId: item.id,
          name: item.name,
          category: (item.category ?? "other") as ItemCategory,
          unit: lineUnit,
          colorKey: colorKey || null,
          varietyKey: varietyKey || null,
          qtyByRestaurant: {},
          total: 0,
        };
        itemMap.set(key, row);
      }
      row.qtyByRestaurant[restaurantId] = (row.qtyByRestaurant[restaurantId] ?? 0) + qty;
      row.total += qty;
    }
  }

  // Group harvest rows by category (CATEGORY_ORDER), alphabetical within each.
  const harvestByCategory: Record<string, HarvestGridRow[]> = {};
  for (const row of itemMap.values()) {
    if (!harvestByCategory[row.category]) harvestByCategory[row.category] = [];
    harvestByCategory[row.category].push(row);
  }
  for (const cat of Object.keys(harvestByCategory)) {
    harvestByCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
  }
  const harvestCategories: HarvestGridCategory[] = CATEGORY_ORDER
    .filter((c) => harvestByCategory[c])
    .map((c) => ({ key: c, rows: harvestByCategory[c] }));

  // Container calculator — how many of each vessel to grab, by unit total.
  const CONTAINER_MAP: Record<string, { label: string; icon: string }> = {
    lg: { label: "Large To-Go", icon: "📦" },
    sm: { label: "Small To-Go", icon: "📦" },
    lbs: { label: "Green Bin", icon: "🟩" },
    bx: { label: "Box", icon: "📦" },
    bu: { label: "Bunch", icon: "🌿" },
    qt: { label: "Quart", icon: "🥤" },
    pt: { label: "Pint", icon: "🥤" },
    cs: { label: "Case", icon: "📦" },
    kit: { label: "Kit", icon: "🧰" },
  };
  const containerCounts: Record<string, HarvestGridContainer> = {};
  for (const row of itemMap.values()) {
    if (row.unit === "ea") continue;
    const c = CONTAINER_MAP[row.unit];
    if (!c) continue;
    if (!containerCounts[row.unit]) {
      containerCounts[row.unit] = { unit: row.unit, label: c.label, count: 0, icon: c.icon };
    }
    containerCounts[row.unit].count += row.total;
  }
  const harvestContainers = Object.values(containerCounts)
    .filter((v) => v.count > 0)
    .sort((a, b) => b.count - a.count);

  const harvestItemCount = itemMap.size;

  // Per-order picked counts for the restaurant-card header badges
  const orderProgress = new Map<string, { picked: number; total: number; shorted: number }>();
  for (const order of orders) {
    const items = order.order_items ?? [];
    orderProgress.set(order.id, {
      total: items.length,
      picked: items.filter((oi: any) => oi.picked_at).length,
      shorted: items.filter((oi: any) => oi.is_shorted).length,
    });
  }

  return (
    <main>
      <header className="page-header sticky top-0 z-30 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/admin/orders"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white -ml-2"
              aria-label="Back to orders"
            >
              ←
            </Link>
            <h1 className="page-title">Orders</h1>
          </div>
          <PrintButton />
        </div>
      </header>
      <div className="print:hidden">
        <EditorialHero
          eyebrow={formatDeliveryDate(date)}
          title="Order Detail"
          subtitle={`${orders.length} restaurant${orders.length !== 1 ? "s" : ""} ordering for this date`}
          flower="squash-blossom"
          backHref="/admin/orders"
        />
      </div>

      {/* Print-only header — the combined page prints as the harvest list. */}
      <div className="hidden print:block px-4 py-4">
        <h1 className="text-xl font-bold">HARVEST LIST — {formatDeliveryDate(date)}</h1>
        <p className="text-sm text-farm-muted/90">
          {harvestItemCount} item{harvestItemCount === 1 ? "" : "s"}
          {restaurantsInPlay.length > 0 && (
            <> · {restaurantsInPlay.map((r) => r.name).join(" / ")}</>
          )}
        </p>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6 pb-32 print:py-2 print:space-y-4">
        {/* Combined harvest grid — what to grab from the field before the
            per-restaurant pack split. One row per (crop, container) with a
            column per restaurant. This is the print artifact; the
            interactive per-restaurant workflow below is hidden on print. */}
        {harvestItemCount > 0 && (
          <HarvestGrid
            restaurants={restaurantsInPlay}
            categories={harvestCategories}
            containers={harvestContainers}
          />
        )}

        {/* Interactive per-restaurant workflow — screen only. Printing the
            page produces just the harvest grid above. */}
        <div className="print:hidden space-y-6">
        {/* Empty-receiver banner — shown only when there are orders to pick
            (otherwise it'd be noise on a "no orders yet" date). Surfaces
            the gap BEFORE pick-and-pack starts so admin can invite a
            receiver without losing context later. */}
        {orders.length > 0 && (activeReceiverCount ?? 0) === 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800">No active receivers</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              The &quot;Finish &amp; Send to Receiver&quot; button needs at least one active
              receiver account.{" "}
              <Link href="/admin/settings/users" className="underline font-medium">
                Invite a receiver
              </Link>
              {" "}so they get today&apos;s incoming summary by email.
            </p>
          </div>
        )}

        {orders.length === 0 && (
          <div className="text-center py-10">
            <img src="/assets/pressfarm/flowers/pea-flower.png" alt="" aria-hidden="true" className="mx-auto h-24 w-auto mb-4" />
            <h3 className="text-base font-semibold text-farm-dark">No orders yet</h3>
            <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">
              Chefs haven&apos;t placed orders for this date yet. They&apos;ll show up here once submitted.
            </p>
            <Link
              href="/admin/availability"
              className="btn-secondary inline-flex items-center mt-5 px-4 text-sm"
            >
              Check availability
            </Link>
          </div>
        )}

        {orders.map((order) => {
          // Group order items by category
          const byCategory: Record<string, any[]> = {};
          for (const oi of order.order_items ?? []) {
            const category: string = oi.availability_item?.item?.category ?? "other";
            if (!byCategory[category]) byCategory[category] = [];
            byCategory[category].push(oi);
          }

          // Sort categories using CATEGORY_ORDER
          const sortedCategories = CATEGORY_ORDER.filter((c) => byCategory[c]);

          const totalItems = order.order_items?.length ?? 0;
          const shortedItems = order.order_items?.filter((i: any) => i.is_shorted) ?? [];
          const progress = orderProgress.get(order.id) ?? { picked: 0, total: 0, shorted: 0 };
          const resolved = progress.picked + progress.shorted;

          return (
            <section key={order.id} className={cn("card overflow-hidden border-l-2", laneStyle(order.restaurant?.name).border)}>
              {/* Restaurant header */}
              <div className="px-4 py-3 border-b border-farm-dark/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <LaneBadge name={order.restaurant?.name ?? "Restaurant"} className="mb-1" />
                  <h2 className={cn("text-lg leading-tight text-farm-dark", laneStyle(order.restaurant?.name).nameClass)}>
                    {order.restaurant?.name ?? "Restaurant"}
                  </h2>
                  {order.event_name && (
                    <p className="text-sm text-pf-master-violet font-medium mt-0.5">
                      {order.event_name}
                      {order.event_date ? ` · event ${formatDeliveryDate(order.event_date)}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-farm-muted mt-0.5">
                    {order.chef?.full_name ?? "Chef"} ·{" "}
                    {order.submitted_at
                      ? formatTimePacific(order.submitted_at)
                      : "Not submitted"}
                    {" · "}{totalItems} items
                  </p>
                  {order.edited_by?.full_name &&
                    order.last_edited_by &&
                    order.last_edited_by !== order.chef?.id && (
                      <p className="text-[11px] text-farm-muted/80 mt-0.5">
                        last edited by {order.edited_by.full_name}
                        {order.last_edited_at && (
                          <> at {formatTimePacific(order.last_edited_at)}</>
                        )}
                      </p>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Picked-progress badge — primary signal during the
                      harvest run. Includes shortages because they're
                      "resolved" lines too (admin doesn't pick them but
                      they don't block hand-off). */}
                  {progress.total > 0 && (
                    <span
                      className={`text-[11px] font-semibold tabular-nums px-2 py-1 rounded-full ${
                        resolved === progress.total
                          ? "bg-farm-green/15 text-farm-green"
                          : resolved > 0
                            ? "bg-pf-master-violet/10 text-pf-master-violet"
                            : "bg-farm-cream text-farm-muted"
                      }`}
                      title={`${progress.picked} picked · ${progress.shorted} shorted · ${progress.total - resolved} remaining`}
                    >
                      {resolved}/{progress.total}
                    </span>
                  )}
                  <StatusPill status={order.status as OrderStatus} />
                </div>
              </div>

              {/* Chef notes */}
              {order.freeform_notes && (
                <div className="px-4 py-2 bg-farm-cream/60 border-b border-farm-green/15">
                  <p className="text-xs font-medium text-farm-green mb-0.5">Chef Notes</p>
                  <p className="text-sm text-farm-dark">{order.freeform_notes}</p>
                </div>
              )}

              {/* Shortage summary */}
              {shortedItems.length > 0 && (
                <div className="px-4 py-2 bg-pf-master-orange/8 border-b border-pf-master-orange/20">
                  <p className="text-xs font-medium text-pf-master-orange">
                    {shortedItems.length} item{shortedItems.length !== 1 ? "s" : ""} shorted
                  </p>
                </div>
              )}

              {/* Items by category — tap any row to mark/edit shortage */}
              {(order.status !== "fulfilled" && order.status !== "cancelled") && (
                <div className="px-4 py-1.5 bg-pf-master-orange/[0.04] border-b border-pf-master-orange/20">
                  <p className="text-[11px] text-pf-master-orange">
                    Tap any item to mark a shortage
                  </p>
                </div>
              )}
              <div>
                {sortedCategories.map((category) => {
                  const catItems = byCategory[category];
                  catItems.sort((a: any, b: any) =>
                    (a.availability_item?.item?.name ?? "").localeCompare(
                      b.availability_item?.item?.name ?? ""
                    )
                  );

                  return (
                    <div key={category}>
                      <div className="px-4 py-2 bg-farm-cream/60">
                        <p className="section-eyebrow with-flower text-farm-muted">
                          {CATEGORY_LABELS[category as ItemCategory] ?? category}
                        </p>
                      </div>
                      {catItems.map((oi: any) => {
                        const item = oi.availability_item?.item;
                        return (
                          <InlineShortageRow
                            key={oi.id}
                            orderId={order.id}
                            canEdit={order.status !== "fulfilled" && order.status !== "cancelled"}
                            catalogItems={catalogItems}
                            orderItem={{
                              id: oi.id,
                              itemName: item?.name ?? "Unknown item",
                              category: item?.category ?? "other",
                              // Per-line unit (added in migration 027) wins over
                              // the catalog's multi-unit string. Falls back to the
                              // catalog item's first declared unit for older lines
                              // that haven't been backfilled.
                              unitType:
                                (oi.unit_type ?? "").trim() ||
                                String(item?.unit_type ?? "")
                                  .split(",")
                                  .map((u: string) => u.trim())
                                  .filter(Boolean)[0] ||
                                "",
                              sizeLabel: oi.size_label ?? null,
                              colorKey: oi.color_key ?? null,
                              varietyKey: oi.variety_key ?? null,
                              isEvent: oi.menu_section === "events",
                              quantityRequested: oi.quantity_requested,
                              quantityFulfilled: oi.quantity_fulfilled,
                              isShorted: oi.is_shorted,
                              shortageReason: oi.shortage_reason,
                              pickedAt: oi.picked_at ?? null,
                              replacementItemId: oi.replacement_item_id ?? null,
                              replacementLabel: oi.replacement_label ?? null,
                              replacementQuantity: oi.replacement_quantity ?? null,
                              replacementUnit: oi.replacement_unit ?? null,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Extras already added (delivery_items not on the original order).
                  Always renders if any exist — admin needs visibility on what's
                  going out beyond the chef's order even after fulfillment. */}
              <ExtrasList orderId={order.id} extras={extrasByRestaurant[order.id] ?? []} />

              {/* Add extras during pick-and-pack — only when the order is still
                  open (not fulfilled or cancelled). Shows up inline below the
                  items list so admin can throw produce in without leaving the page. */}
              {order.status !== "fulfilled" && order.status !== "cancelled" && (
                <div className="px-4 py-3 border-t border-farm-dark/5">
                  <AddExtraRow orderId={order.id} allItems={catalogItems} />
                </div>
              )}

              {/* Actions */}
              <div className="px-4 py-3 border-t border-farm-dark/5 flex items-center justify-between">
                {order.status !== "fulfilled" && order.status !== "cancelled" ? (
                  <FulfillButton orderId={order.id} currentStatus={order.status} />
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-4">
                  <Link
                    href={`/admin/orders/${date}/${order.id}/edit`}
                    className="flex items-center gap-1.5 text-xs text-pf-master-blue hover:text-pf-master-blue/80 transition-colors min-h-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Link>
                  <DeleteOrderButton orderId={order.id} restaurantName={order.restaurant?.name ?? "this"} />
                </div>
              </div>

              {/* Activity timeline — who placed/edited/shorted/fulfilled, when. */}
              {(auditByOrder.get(order.id)?.length ?? 0) > 0 && (
                <div className="border-t border-farm-dark/5">
                  <OrderActivity entries={auditByOrder.get(order.id) ?? []} bare />
                </div>
              )}
            </section>
          );
        })}
        </div>

      </div>

      {/* Sticky hand-off bar — only renders when there are orders to
          process. Tracks pick + shortage progress and fires the
          send-to-receiver flow (status bump + email). Screen only. */}
      <div className="print:hidden">
        <SendToReceiverBar
          date={date}
          totalLines={totalLines}
          resolvedLines={resolvedLines}
          submittedOrderCount={submittedOrderCount}
        />
      </div>
    </main>
  );
}
