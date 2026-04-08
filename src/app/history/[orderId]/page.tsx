import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate, formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS, UNIT_LABELS } from "@/lib/constants";
import type { OrderStatus, UnitType } from "@/types";

/**
 * /history/[orderId] — Chef order detail view (Server Component)
 *
 * Shows all ordered items, quantities requested vs. fulfilled, shortage notes.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch order with all items (RLS ensures chef can only see their restaurant's orders)
  const { data: order } = await supabase
    .from("orders")
    .select(`
      id,
      delivery_date,
      status,
      freeform_notes,
      submitted_at,
      created_at,
      restaurant_id,
      restaurants(name),
      order_items(
        id,
        quantity_requested,
        quantity_fulfilled,
        is_shorted,
        shortage_reason,
        unit_price_at_order,
        availability_items(
          id,
          status,
          item:items(
            id,
            name,
            category,
            unit_type
          )
        )
      )
    `)
    .eq("id", orderId)
    .single() as any;

  if (!order) {
    notFound();
  }

  // Check if ordering is still open for this delivery date
  const { data: deliveryDateRow } = await supabase
    .from("delivery_dates")
    .select("ordering_open")
    .eq("date", order.delivery_date)
    .single() as any;

  const canEdit =
    ["submitted", "draft"].includes(order.status) &&
    deliveryDateRow?.ordering_open === true;

  const status = order.status as OrderStatus;
  const restaurant = (order.restaurants as any)?.name ?? "Restaurant";
  const orderItems = (order.order_items ?? []) as any[];

  const hasShortages = orderItems.some((oi: any) => oi.is_shorted);

  const totalOrdered = orderItems.reduce((sum: number, oi: any) => {
    if (oi.unit_price_at_order != null) {
      return sum + oi.unit_price_at_order * oi.quantity_requested;
    }
    return sum;
  }, 0);

  const hasPrices = orderItems.some((oi: any) => oi.unit_price_at_order != null);

  return (
    <main className="min-h-screen bg-farm-cream pb-20">
      <header className="page-header flex items-center gap-3">
        <Link
          href="/history"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white -ml-2 text-2xl"
          aria-label="Back to history"
        >
          ‹
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">
            {formatDeliveryDate(order.delivery_date)}
          </h1>
          <p className="text-sm text-gray-500">{restaurant}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canEdit && (
            <Link
              href={`/order?edit=${order.id}`}
              className="text-sm font-medium text-white border border-white/40 rounded-lg px-3 py-1.5 min-h-0 hover:bg-white/20 transition-colors"
            >
              Edit
            </Link>
          )}
          <StatusPill status={status} />
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Shortage warning banner */}
        {hasShortages && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-yellow-800">
              Some items in this order were shorted.
            </p>
          </div>
        )}

        {/* Order items */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Items ({orderItems.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {orderItems.map((oi: any) => {
              const availItem = oi.availability_items as any;
              const item = availItem?.item as any;
              if (!item) return null;

              const unit = item.unit_type as UnitType;
              const isShorted = oi.is_shorted;
              const qtyFulfilled = oi.quantity_fulfilled;

              return (
                <li key={oi.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {UNIT_LABELS[unit] ?? unit}
                        {oi.unit_price_at_order != null && (
                          <span className="ml-1">
                            · {formatCurrency(oi.unit_price_at_order)} each
                          </span>
                        )}
                      </p>
                      {isShorted && oi.shortage_reason && (
                        <p className="text-xs text-yellow-700 mt-1 bg-yellow-50 rounded px-2 py-1">
                          Shortage: {oi.shortage_reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        &times; {oi.quantity_requested}
                      </p>
                      {isShorted && qtyFulfilled != null && (
                        <p className="text-xs text-yellow-700">
                          Fulfilled: {qtyFulfilled}
                        </p>
                      )}
                      {oi.unit_price_at_order != null && (
                        <p className="text-xs text-gray-500">
                          {formatCurrency(oi.unit_price_at_order * oi.quantity_requested)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Total row */}
          {hasPrices && (
            <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Estimated Total</span>
              <span className="text-base font-bold text-gray-900">
                {formatCurrency(totalOrdered)}
              </span>
            </div>
          )}
        </div>

        {/* Freeform notes */}
        {order.freeform_notes && (
          <div className="card px-4 py-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Notes for Micheal</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.freeform_notes}</p>
          </div>
        )}

        {/* Order metadata */}
        <div className="card px-4 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status</span>
            <span className="font-medium text-gray-900">{ORDER_STATUS_LABELS[status]}</span>
          </div>
          {order.submitted_at && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Submitted</span>
              <span className="font-medium text-gray-900">
                {new Date(order.submitted_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order ID</span>
            <span className="font-mono text-xs text-gray-400">{order.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    draft: "bg-gray-100 text-gray-500",
    submitted: "bg-blue-50 text-blue-600",
    in_progress: "bg-yellow-50 text-yellow-700",
    fulfilled: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${colors[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
