import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/types";

/**
 * /history — Chef order history list (Server Component)
 *
 * Fetches all past orders for the chef's restaurant, most recent first.
 */
export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get chef's restaurant
  const { data: restaurantUser } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name)")
    .eq("user_id", user.id)
    .single() as any;

  if (!restaurantUser?.restaurants) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-4 py-4">
          <h1 className="text-lg font-semibold">Order History</h1>
        </header>
        <div className="flex items-center justify-center h-64 px-4">
          <p className="text-center text-gray-500 text-sm">
            No restaurant found. Please contact Micheal.
          </p>
        </div>
      </main>
    );
  }

  const restaurant = restaurantUser.restaurants;

  // Fetch all orders with item count
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      delivery_date,
      status,
      submitted_at,
      created_at,
      order_items(id)
    `)
    .eq("restaurant_id", restaurant.id)
    .order("delivery_date", { ascending: false }) as any;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Order History</h1>
        <p className="text-sm text-gray-500">{restaurant.name}</p>
      </header>

      <div className="px-4 py-4">
        {!orders || orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No past orders yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {orders.map((order: any) => {
              const itemCount = order.order_items?.length ?? 0;
              const status = order.status as OrderStatus;

              return (
                <li key={order.id}>
                  <Link
                    href={`/history/${order.id}`}
                    className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-4 min-h-[64px] active:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDeliveryDate(order.delivery_date)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={status} />
                      <span className="text-gray-300 text-lg">›</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
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
      className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
