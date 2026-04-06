import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { formatDate, formatCurrency, todayISODate } from "@/lib/utils";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  // Get next 4 upcoming delivery dates
  const today = todayISODate();
  const { data: deliveryDates } = await supabase
    .from("delivery_dates")
    .select("*")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(4);

  const nextDate = deliveryDates?.[0];

  // Get orders for next delivery date
  const { data: orders } = nextDate
    ? await admin
        .from("orders")
        .select(`
          *,
          restaurants(name, slug),
          order_items(
            id,
            quantity_requested,
            unit_price_at_order,
            availability_items(
              items(name, unit_type)
            )
          )
        `)
        .eq("delivery_date", nextDate.date)
        .order("created_at")
    : { data: null };

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <h1 className="text-lg font-semibold">Orders</h1>
        {nextDate && (
          <p className="text-sm text-gray-500 capitalize">
            {nextDate.day_of_week} · {formatDate(nextDate.date)}
          </p>
        )}
      </header>

      <div className="px-4 py-4 space-y-3">
        {/* Upcoming dates selector */}
        {(deliveryDates?.length ?? 0) > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {deliveryDates?.map((dd) => (
              <Link
                key={dd.id}
                href={`/admin/orders/${dd.date}`}
                className="flex-shrink-0 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-600"
              >
                {formatDate(dd.date)}
              </Link>
            ))}
          </div>
        )}

        {nextDate && (
          <div className="flex gap-2">
            <Link
              href={`/admin/orders/harvest`}
              className="flex-1 bg-farm-green text-white text-center text-sm font-medium py-3 rounded-xl"
            >
              🌿 Harvest List
            </Link>
            <Link
              href={`/admin/availability/${nextDate.date}`}
              className="flex-1 bg-white border border-gray-200 text-gray-700 text-center text-sm font-medium py-3 rounded-xl"
            >
              Edit Availability
            </Link>
          </div>
        )}

        {/* Order cards */}
        {!orders?.length && (
          <div className="text-center text-gray-400 text-sm py-12">
            <p className="text-3xl mb-3">📋</p>
            <p>No orders yet for {nextDate ? formatDate(nextDate.date) : "upcoming dates"}.</p>
          </div>
        )}

        {orders?.map((order) => {
          const restaurant = order.restaurants as { name: string; slug: string } | null;
          const itemCount = order.order_items?.length ?? 0;
          const statusColor: Record<string, string> = {
            draft: "text-gray-400",
            submitted: "text-blue-600",
            in_progress: "text-yellow-600",
            fulfilled: "text-green-600",
            cancelled: "text-red-500",
          };
          return (
            <Link
              key={order.id}
              href={`/admin/orders/${order.delivery_date}?restaurantId=${order.restaurant_id}`}
              className="block bg-white rounded-2xl border border-gray-100 px-4 py-4 active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{restaurant?.name ?? "Restaurant"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium capitalize ${statusColor[order.status] ?? "text-gray-500"}`}>
                    {order.status.replace("_", " ")}
                  </p>
                  {order.submitted_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
