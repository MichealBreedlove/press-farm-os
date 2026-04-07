import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { DateNav } from "./DateNav";
import { OrderingToggle } from "./OrderingToggle";
import { RestaurantWordmark } from "@/components/shared/RestaurantWordmark";
import Link from "next/link";

interface AdminOrdersPageProps {
  searchParams: Promise<{ date?: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "badge-gray",
  submitted: "badge-blue",
  in_progress: "badge-gold",
  fulfilled: "badge-green",
  cancelled: "badge-red",
};

/**
 * /admin/orders — Orders dashboard (server component)
 *
 * Shows orders for the next upcoming (or selected) delivery date.
 * Per-restaurant order cards. Date switcher. Close/open ordering toggle.
 */
export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch all delivery dates sorted ascending
  const { data: allDates } = await (supabase as any)
    .from("delivery_dates")
    .select("id, date, ordering_open")
    .order("date", { ascending: true });

  const dates: { id: string; date: string; ordering_open: boolean }[] = allDates ?? [];

  // Determine active date: param > next upcoming > most recent
  let activeDate: string;
  if (dateParam && dates.find((d) => d.date === dateParam)) {
    activeDate = dateParam;
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

  return (
    <main>
      <header className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Orders</h1>
          {activeDateRecord && (
            <OrderingToggle
              deliveryDateId={activeDateRecord.id}
              orderingOpen={activeDateRecord.ordering_open}
            />
          )}
        </div>
        <DateNav
          currentDate={activeDate}
          prevDate={prevDate}
          nextDate={nextDate}
          formattedDate={formatDeliveryDate(activeDate)}
        />
      </header>

      <div className="px-4 py-6 space-y-4">
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
                    <p className="text-sm text-gray-400 mt-0.5">Awaiting order</p>
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
                  <h3 className="font-semibold text-farm-dark">{restaurant.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {order.chef?.full_name ?? "Chef"} ·{" "}
                    {order.submitted_at
                      ? new Date(order.submitted_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Not submitted"}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 ${
                    STATUS_COLORS[order.status] ?? "badge-gray"
                  }`}
                >
                  {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
                </span>
              </div>

              <div className="flex gap-4 mt-3 text-sm text-gray-500">
                <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                {shortedCount > 0 && (
                  <span className="text-orange-600">{shortedCount} shorted</span>
                )}
                {order.freeform_notes && (
                  <span className="text-blue-600">Has notes</span>
                )}
              </div>
            </Link>
          );
        })}

        {restaurants.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No restaurants found.</p>
        )}

        {/* Actions */}
        <div className="pt-2">
          <Link
            href={`/admin/orders/harvest?date=${activeDate}`}
            className="btn-primary flex items-center justify-center min-h-[44px] w-full text-sm font-medium"
          >
            View Harvest List
          </Link>
        </div>
      </div>
    </main>
  );
}
