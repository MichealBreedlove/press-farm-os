import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate, formatQty } from "@/lib/utils";
import { UNIT_LABELS, ORDER_STATUS_LABELS, CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/constants";
import { FulfillButton } from "./FulfillButton";
import Link from "next/link";
import type { ItemCategory } from "@/types";

interface AdminOrdersByDatePageProps {
  params: Promise<{ date: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-50 text-blue-700",
  in_progress: "bg-yellow-50 text-yellow-700",
  fulfilled: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

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
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700 -ml-2"
            aria-label="Back to orders"
          >
            ←
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Orders — {formatDeliveryDate(date)}
            </h1>
            <p className="text-sm text-gray-500">{orders.length} restaurant{orders.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {orders.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            No orders have been submitted for this date.
          </p>
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
            <section key={order.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Restaurant header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">
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
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
                  </span>
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

              {/* Items by category */}
              <div className="divide-y divide-gray-50">
                {sortedCategories.map((category) => {
                  const catItems = byCategory[category];
                  // Sort alphabetically within category
                  catItems.sort((a: any, b: any) =>
                    (a.availability_item?.item?.name ?? "").localeCompare(
                      b.availability_item?.item?.name ?? ""
                    )
                  );

                  return (
                    <div key={category}>
                      <div className="px-4 py-2 bg-gray-50">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {CATEGORY_LABELS[category as ItemCategory] ?? category}
                        </h3>
                      </div>
                      {catItems.map((oi: any) => {
                        const item = oi.availability_item?.item;
                        const isShorted = oi.is_shorted;

                        return (
                          <div
                            key={oi.id}
                            className={`px-4 py-3 flex items-center gap-3 ${
                              isShorted ? "bg-orange-50" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isShorted ? "text-orange-800" : "text-gray-900"
                                }`}
                              >
                                {item?.name ?? "Unknown item"}
                              </p>
                              {isShorted && oi.shortage_reason && (
                                <p className="text-xs text-orange-600 mt-0.5">{oi.shortage_reason}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-xs text-gray-400 mr-1">
                                {UNIT_LABELS[item?.unit_type as keyof typeof UNIT_LABELS] ?? item?.unit_type ?? ""}
                              </span>
                              {isShorted ? (
                                <span className="text-sm text-orange-700 font-semibold">
                                  {formatQty(oi.quantity_fulfilled ?? 0)}{" "}
                                  <span className="line-through text-gray-400 font-normal">
                                    {formatQty(oi.quantity_requested)}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-sm font-semibold text-gray-900">
                                  {formatQty(oi.quantity_requested)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              {order.status !== "fulfilled" && order.status !== "cancelled" && (
                <div className="px-4 py-3 border-t border-gray-100">
                  <FulfillButton orderId={order.id} />
                </div>
              )}
            </section>
          );
        })}

        {orders.length > 0 && (
          <Link
            href={`/admin/orders/harvest?date=${date}`}
            className="flex items-center justify-center min-h-[44px] w-full bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800 transition-colors"
          >
            View Harvest List
          </Link>
        )}
      </div>
    </main>
  );
}
