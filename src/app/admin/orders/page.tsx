import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { DateNav } from "./DateNav";
import { OrderingToggle } from "./OrderingToggle";
import { RestaurantWordmark } from "@/components/shared/RestaurantWordmark";
import { StatusPill } from "@/components/shared/StatusPill";
import { EditorialHero } from "@/components/shared/EditorialHero";
import Link from "next/link";
import type { OrderStatus } from "@/types";

interface AdminOrdersPageProps {
  searchParams: Promise<{ date?: string; status?: string }>;
}

/**
 * /admin/orders — Orders dashboard (server component)
 *
 * Shows orders for the next upcoming (or selected) delivery date.
 * Per-restaurant order cards. Date switcher. Close/open ordering toggle.
 */
export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const { date: dateParam, status: statusFilter } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // If filtering by status (e.g., from dashboard "Pending Orders" card),
  // jump to the date of the first matching order
  let effectiveDateParam = dateParam;
  if (!effectiveDateParam && statusFilter) {
    const { data: firstMatch } = await (supabase as any)
      .from("orders")
      .select("delivery_date")
      .eq("status", statusFilter)
      .order("delivery_date", { ascending: false })
      .limit(1)
      .single();
    if (firstMatch?.delivery_date) effectiveDateParam = firstMatch.delivery_date;
  }

  // Fetch all delivery dates sorted ascending
  const { data: allDates } = await (supabase as any)
    .from("delivery_dates")
    .select("id, date, ordering_open")
    .order("date", { ascending: true });

  const dates: { id: string; date: string; ordering_open: boolean }[] = allDates ?? [];

  // Determine active date: param > status-derived > next upcoming > most recent
  let activeDate: string;
  if (effectiveDateParam && dates.find((d) => d.date === effectiveDateParam)) {
    activeDate = effectiveDateParam;
  } else {
    const upcoming = dates.find((d) => d.date >= today);
    activeDate = upcoming?.date ?? dates[dates.length - 1]?.date ?? today;
  }

  const activeDateRecord = dates.find((d) => d.date === activeDate);
  const activeDateIndex = dates.findIndex((d) => d.date === activeDate);
  const prevDate = activeDateIndex > 0 ? dates[activeDateIndex - 1].date : null;
  const nextDate = activeDateIndex < dates.length - 1 ? dates[activeDateIndex + 1].date : null;

  // Fetch orders for active date with restaurant, chef, and item count
  const { data: ordersRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, delivery_date, status, freeform_notes, submitted_at,
      restaurant:restaurants(id, name),
      chef:profiles!orders_chef_id_fkey(id, full_name),
      order_items(id, is_shorted)
    `)
    .eq("delivery_date", activeDate);

  const orders: any[] = ordersRaw ?? [];

  // Fetch restaurants to show cards even for restaurants with no order
  const { data: restaurantsRaw } = await (supabase as any)
    .from("restaurants")
    .select("id, name")
    .order("name", { ascending: true });

  const restaurants: { id: string; name: string }[] = restaurantsRaw ?? [];

  // Count submitted vs fulfilled orders for the current date
  const submittedCount = orders.filter((o) => o.status === "submitted").length;
  const fulfilledCount = orders.filter((o) => o.status === "fulfilled").length;
  const orderSummary =
    orders.length === 0
      ? "No orders yet for this date"
      : `${submittedCount} pending · ${fulfilledCount} fulfilled · ${orders.length} total`;

  return (
    <main>
      <header className="page-header sticky top-0 z-30">
        <h1 className="page-title">Orders</h1>
        <DateNav
          currentDate={activeDate}
          prevDate={prevDate}
          nextDate={nextDate}
          formattedDate={formatDeliveryDate(activeDate)}
        />
      </header>
      <EditorialHero
        eyebrow="Daily Operations"
        title="Orders"
        subtitle={orderSummary}
        flower="squash-blossom"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-4">
        {restaurants.map((restaurant) => {
          const order = orders.find((o) => o.restaurant?.id === restaurant.id);

          if (!order) {
            return (
              <div
                key={restaurant.id}
                className="card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3><RestaurantWordmark name={restaurant.name} size="md" /></h3>
                    <p className="text-sm text-farm-muted mt-0.5">Awaiting order</p>
                  </div>
                  <span className="badge-gray">
                    Not submitted
                  </span>
                </div>
              </div>
            );
          }

          const itemCount = order.order_items?.length ?? 0;
          const shortedCount = order.order_items?.filter((i: any) => i.is_shorted).length ?? 0;

          return (
            <Link
              key={restaurant.id}
              href={`/admin/orders/${activeDate}`}
              className="block card-interactive p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3><RestaurantWordmark name={restaurant.name} size="md" /></h3>
                  <p className="text-sm text-farm-muted mt-0.5">
                    {order.chef?.full_name ?? "Chef"} ·{" "}
                    {order.submitted_at
                      ? new Date(order.submitted_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Not submitted"}
                  </p>
                </div>
                <StatusPill status={order.status as OrderStatus} />
              </div>

              <div className="flex gap-4 mt-3 text-sm text-farm-muted">
                <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                {shortedCount > 0 && (
                  <span className="text-orange-600">{shortedCount} shorted</span>
                )}
                {order.freeform_notes && (
                  <span className="text-farm-green">Has notes</span>
                )}
              </div>
            </Link>
          );
        })}

        {restaurants.length === 0 && (
          <p className="text-center text-farm-muted text-sm py-8">No restaurants found.</p>
        )}

        {/* Actions */}
        <div className="pt-2 space-y-3">
          {activeDateRecord && (
            <OrderingToggle
              deliveryDateId={activeDateRecord.id}
              orderingOpen={activeDateRecord.ordering_open}
            />
          )}
        </div>
      </div>
    </main>
  );
}
