import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/constants";
import { FulfillButton } from "./FulfillButton";
import { DeleteOrderButton } from "./DeleteOrderButton";
import { InlineShortageRow } from "./InlineShortageRow";
import { StatusPill } from "@/components/shared/StatusPill";
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
        id, quantity_requested, quantity_fulfilled, is_shorted, shortage_reason,
        availability_item:availability_items(
          id,
          item:items(id, name, category, unit_type)
        )
      )
    `)
    .eq("delivery_date", date);

  const orders: any[] = ordersRaw ?? [];

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
          <div>
            <h1 className="page-title">
              Orders — {formatDeliveryDate(date)}
            </h1>
            <p className="text-sm text-gray-500">{orders.length} restaurant{orders.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {orders.length === 0 && (
          <div className="text-center py-10">
            <img src="/assets/flowers/pea-flower.png" alt="" aria-hidden="true" className="mx-auto h-24 w-auto mb-4" />
            <h3 className="text-base font-semibold text-farm-dark">No orders yet</h3>
            <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto">
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

          return (
            <section key={order.id} className="card overflow-hidden">
              {/* Restaurant header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-farm-dark">
                    {order.restaurant?.name ?? "Restaurant"}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
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
                  <StatusPill status={order.status as OrderStatus} />
                </div>
              </div>

              {/* Chef notes */}
              {order.freeform_notes && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                  <p className="text-xs font-medium text-blue-700 mb-0.5">Chef Notes</p>
                  <p className="text-sm text-blue-800">{order.freeform_notes}</p>
                </div>
              )}

              {/* Shortage summary */}
              {shortedItems.length > 0 && (
                <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
                  <p className="text-xs font-medium text-orange-700">
                    {shortedItems.length} item{shortedItems.length !== 1 ? "s" : ""} shorted
                  </p>
                </div>
              )}

              {/* Items by category — tap any row to mark/edit shortage */}
              {(order.status !== "fulfilled" && order.status !== "cancelled") && (
                <div className="px-4 py-1.5 bg-orange-50/40 border-b border-orange-100">
                  <p className="text-[11px] text-orange-700">
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
                        <p className="section-eyebrow text-farm-muted">
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
                              unitType: item?.unit_type ?? "",
                              quantityRequested: oi.quantity_requested,
                              quantityFulfilled: oi.quantity_fulfilled,
                              isShorted: oi.is_shorted,
                              shortageReason: oi.shortage_reason,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
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

        {orders.length > 0 && (
          <Link
            href={`/admin/orders/harvest?date=${date}`}
            className="btn-primary flex items-center justify-center min-h-[44px] w-full text-sm font-medium"
          >
            View Harvest List
          </Link>
        )}
      </div>
    </main>
  );
}
