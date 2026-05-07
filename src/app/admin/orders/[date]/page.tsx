import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/constants";
import { FulfillButton } from "./FulfillButton";
import { DeleteOrderButton } from "./DeleteOrderButton";
import { InlineShortageRow } from "./InlineShortageRow";
import { AddExtraRow } from "./AddExtraRow";
import { ExtrasList } from "./ExtrasList";
import { HarvestTotalsPanel } from "./HarvestTotalsPanel";
import { SendToReceiverBar } from "./SendToReceiverBar";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusPill } from "@/components/shared/StatusPill";
import { EditorialHero } from "@/components/shared/EditorialHero";
import Link from "next/link";
import type { ItemCategory, OrderStatus } from "@/types";

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

  // Fetch orders with full item detail
  const { data: ordersRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, delivery_date, status, freeform_notes, submitted_at,
      restaurant:restaurants(id, name),
      chef:profiles!orders_chef_id_fkey(id, full_name),
      order_items(
        id, quantity_requested, quantity_fulfilled, is_shorted, shortage_reason, unit_type, size_label, picked_at,
        availability_item:availability_items(
          id,
          item:items(id, name, category, unit_type)
        )
      )
    `)
    .eq("delivery_date", date);

  const orders: any[] = ordersRaw ?? [];

  // Catalog for the AddExtraRow picker — non-archived items, lightweight columns only.
  // Uses admin client so RLS doesn't filter by chef-restaurant linkage.
  const admin = createAdminClient();
  const { data: catalogRaw } = await (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, unit_prices")
    .eq("is_archived", false)
    .order("name");
  const catalogItems = catalogRaw ?? [];

  // Fetch delivery_items for this date so we can surface "extras" admin has
  // already added during pick-and-pack. An extra is a delivery_item whose
  // item_id has no matching order_item on the same restaurant's order.
  const { data: deliveriesRaw } = await (admin as any)
    .from("deliveries")
    .select(`
      id, restaurant_id, delivery_date,
      delivery_items (
        id, item_id, quantity, unit, unit_price,
        items ( id, name, unit_type )
      )
    `)
    .eq("delivery_date", date);

  // Active-receiver count — for the empty-state banner that surfaces the
  // gap BEFORE pick-and-pack (so admin can invite a receiver before
  // wasting time annotating shortages).
  const { count: activeReceiverCount } = await (admin as any)
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "receiver")
    .eq("is_active", true);

  // Build a map: restaurant_id → list of "extras" (delivery_items not on the order)
  const extrasByRestaurant: Record<string, Array<{ id: string; itemName: string; quantity: number; unit: string }>> = {};
  for (const order of orders) {
    const orderedItemIds = new Set(
      (order.order_items ?? []).map((oi: any) => oi.availability_item?.item?.id).filter(Boolean),
    );
    const delivery = (deliveriesRaw ?? []).find((d: any) => d.restaurant_id === order.restaurant?.id);
    const extras = (delivery?.delivery_items ?? [])
      .filter((di: any) => di.items && !orderedItemIds.has(di.items.id))
      .map((di: any) => ({
        id: di.id,
        itemName: di.items.name,
        quantity: Number(di.quantity ?? 0),
        unit: String(di.unit ?? "").toUpperCase(),
      }));
    extrasByRestaurant[order.id] = extras;
  }

  // ── Harvest aggregate + pick progress ──
  // Roll up every order_item across every restaurant into (item, unit)
  // buckets so the admin can see what to grab from the field before the
  // per-restaurant pack split. Also count resolved lines (picked OR
  // shorted) so the sticky bottom bar shows real progress.
  type AggKey = string;
  const aggMap = new Map<
    AggKey,
    { itemName: string; unit: string; total: number; byRestaurant: Map<string, number> }
  >();
  let totalLines = 0;
  let resolvedLines = 0;
  let submittedOrderCount = 0;
  for (const order of orders) {
    if (order.status === "submitted") submittedOrderCount += 1;
    for (const oi of order.order_items ?? []) {
      const item = oi.availability_item?.item;
      if (!item) continue;
      totalLines += 1;
      // A line is "resolved" if the admin has either checked it off as
      // picked OR marked it as shorted. Both close the loop on that
      // line for receiver hand-off.
      if (oi.picked_at || oi.is_shorted) resolvedLines += 1;

      const lineUnit = (oi.unit_type ?? "").trim().toLowerCase() ||
        (String(item.unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean)[0] ?? "ea");
      const qty = oi.is_shorted ? Number(oi.quantity_fulfilled ?? 0) : Number(oi.quantity_requested ?? 0);
      if (qty <= 0) continue;

      const key = `${item.id}|${lineUnit}`;
      const restaurantName = order.restaurant?.name ?? "?";
      const existing = aggMap.get(key);
      if (existing) {
        existing.total += qty;
        existing.byRestaurant.set(
          restaurantName,
          (existing.byRestaurant.get(restaurantName) ?? 0) + qty,
        );
      } else {
        aggMap.set(key, {
          itemName: item.name,
          unit: lineUnit,
          total: qty,
          byRestaurant: new Map([[restaurantName, qty]]),
        });
      }
    }
  }
  const harvestRows = [...aggMap.values()]
    .map((r) => ({
      itemName: r.itemName,
      unit: r.unit,
      total: r.total,
      byRestaurant: [...r.byRestaurant.entries()].map(([name, qty]) => ({ name, qty })),
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));

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
      <header className="page-header sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white -ml-2"
            aria-label="Back to orders"
          >
            ←
          </Link>
          <h1 className="page-title">Orders</h1>
        </div>
      </header>
      <EditorialHero
        eyebrow={formatDeliveryDate(date)}
        title="Order Detail"
        subtitle={`${orders.length} restaurant${orders.length !== 1 ? "s" : ""} ordering for this date`}
        flower="squash-blossom"
        backHref="/admin/orders"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6 pb-32">
        {/* Combined harvest totals — collapsible card at the very top.
            Shows what to grab from the field before the per-restaurant
            pack split. Print link opens the dedicated harvest-list page
            for the paper-friendly version. */}
        {harvestRows.length > 0 && (
          <HarvestTotalsPanel
            rows={harvestRows}
            printHref={`/admin/orders/harvest?date=${date}`}
          />
        )}
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
            <section key={order.id} className="card overflow-hidden">
              {/* Restaurant header */}
              <div className="px-4 py-3 border-b border-farm-dark/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-farm-dark">
                    {order.restaurant?.name ?? "Restaurant"}
                  </h2>
                  <p className="text-xs text-farm-muted mt-0.5">
                    {order.chef?.full_name ?? "Chef"} ·{" "}
                    {order.submitted_at
                      ? new Date(order.submitted_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Not submitted"}
                    {" · "}{totalItems} items
                  </p>
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
                              quantityRequested: oi.quantity_requested,
                              quantityFulfilled: oi.quantity_fulfilled,
                              isShorted: oi.is_shorted,
                              shortageReason: oi.shortage_reason,
                              pickedAt: oi.picked_at ?? null,
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
                <DeleteOrderButton orderId={order.id} restaurantName={order.restaurant?.name ?? "this"} />
              </div>
            </section>
          );
        })}

      </div>

      {/* Sticky hand-off bar — only renders when there are orders to
          process. Tracks pick + shortage progress and fires the
          send-to-receiver flow (status bump + email). */}
      <SendToReceiverBar
        date={date}
        totalLines={totalLines}
        resolvedLines={resolvedLines}
        submittedOrderCount={submittedOrderCount}
      />
    </main>
  );
}
