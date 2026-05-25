import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, UNIT_LABELS } from "@/lib/constants";
import { StatusPill } from "@/components/shared/StatusPill";
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
        unit_type,
        size_label,
        color_key,
        menu_section,
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

  // Pull delivery_items for the same date+restaurant so we can surface
  // "extras" — produce Press Farm threw in that wasn't on the chef's order.
  // Chef RLS allows reading their own restaurant's deliveries.
  const { data: chefDelivery } = await supabase
    .from("deliveries")
    .select(`
      id, total_value,
      delivery_items (
        id, item_id, quantity, unit, unit_price,
        items ( id, name, unit_type )
      )
    `)
    .eq("delivery_date", order.delivery_date)
    .eq("restaurant_id", order.restaurant_id)
    .maybeSingle() as any;

  // "Extras" = delivery_items whose item_id is NOT on the order.
  const orderedItemIds = new Set<string>(
    (order.order_items ?? []).map((oi: any) => oi.availability_items?.item?.id).filter(Boolean),
  );
  const extras = (chefDelivery?.delivery_items ?? [])
    .filter((di: any) => di.items && !orderedItemIds.has(di.items.id))
    .map((di: any) => ({
      id: di.id,
      itemName: di.items.name,
      quantity: Number(di.quantity ?? 0),
      unit: String(di.unit ?? "").toUpperCase(),
      unitPrice: di.unit_price != null ? Number(di.unit_price) : null,
    }));

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

  return (
    <main className="min-h-screen bg-farm-cream pb-20">
      <header className="page-header no-wordmark flex items-center gap-3">
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
        {/* Shortage warning banner — uses pf-master-orange to match the
            receiver dashboard's "short" status semantics. */}
        {hasShortages && (
          <div className="bg-pf-master-orange/[0.08] border border-pf-master-orange/30 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-pf-master-orange">
              Some items were shorted — see details below.
            </p>
          </div>
        )}

        {/* Order items */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="section-eyebrow with-flower text-farm-muted">Items · {orderItems.length}</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {orderItems.map((oi: any) => {
              const availItem = oi.availability_items as any;
              const item = availItem?.item as any;
              if (!item) return null;

              // Prefer the chef's chosen unit (oi.unit_type). Fall back to
              // the item's first declared unit for legacy rows.
              const persistedUnit: string | null = oi.unit_type ?? null;
              const unit = (persistedUnit ?? String(item.unit_type ?? "").split(",")[0]?.trim() ?? "") as UnitType;
              const sizeLabel: string | null = oi.size_label ?? null;
              const colorKey: string | null = oi.color_key ?? null;
              const isEvent = oi.menu_section === "events";
              const ordered = Number(oi.quantity_requested ?? 0);
              const fulfilled = oi.quantity_fulfilled != null ? Number(oi.quantity_fulfilled) : null;
              const isShorted = Boolean(oi.is_shorted);

              // Status mirrors the receiver dashboard — same model, same pills.
              let status: "ready" | "short" | "pending";
              if (isShorted) status = "short";
              else if (fulfilled != null) status = "ready";
              else status = "pending";

              return (
                <li key={oi.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-farm-dark truncate">
                          {item.name}
                          {(sizeLabel || colorKey) && (
                            <span className="ml-1.5 text-xs font-normal text-farm-muted">
                              {[
                                sizeLabel,
                                colorKey ? colorKey.split(",").join(" / ") : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </p>
                        {isEvent && (
                          <span className="text-[9px] tracking-wider uppercase bg-pf-master-violet/[0.12] text-pf-master-violet px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                            Events
                          </span>
                        )}
                        {status === "short" && (
                          <span className="text-[9px] tracking-wider uppercase bg-pf-master-orange/[0.12] text-pf-master-orange px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                            Short
                          </span>
                        )}
                        {status === "ready" && (
                          <span className="text-[9px] tracking-wider uppercase bg-farm-green-light text-farm-green px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                            Ready
                          </span>
                        )}
                        {status === "pending" && (
                          <span className="text-[9px] tracking-wider uppercase bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-farm-muted mt-0.5">
                        {UNIT_LABELS[unit] ?? unit}
                      </p>
                      {isShorted && oi.shortage_reason && (
                        <p className="text-xs text-pf-master-orange mt-1 italic">
                          {oi.shortage_reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {status === "short" && fulfilled != null ? (
                        <>
                          <p className="text-sm font-semibold text-pf-master-orange">
                            {fulfilled} of {ordered}
                          </p>
                          <p className="text-[10px] text-farm-muted">
                            short by {ordered - fulfilled}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-farm-dark">
                          &times; {ordered}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

        </div>

        {/* Extras — produce Press Farm threw in beyond the order. Uses the
            same pf-master-blue tone the receiver dashboard uses for "extra"
            so the visual semantics carry across roles. */}
        {extras.length > 0 && (
          <div className="bg-white rounded-2xl border border-pf-master-blue/15 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-pf-master-blue/15 bg-pf-master-blue/[0.04]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-pf-master-blue font-semibold">
                Extras Included · {extras.length}
              </p>
              <p className="text-xs text-farm-muted mt-0.5 leading-relaxed">
                Bonus produce from Press Farm — not on your order.
              </p>
            </div>
            <ul className="divide-y divide-farm-dark/5">
              {extras.map((extra: any) => (
                <li key={extra.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-farm-dark truncate">{extra.itemName}</p>
                      <span className="text-[9px] tracking-wider uppercase bg-pf-master-blue/[0.12] text-pf-master-blue px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                        Extra
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-farm-dark flex-shrink-0">
                    {extra.quantity} {extra.unit}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Freeform notes */}
        {order.freeform_notes && (
          <div className="card px-4 py-4">
            <p className="section-eyebrow with-flower text-farm-muted mb-1.5">Notes for Press Farm</p>
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

