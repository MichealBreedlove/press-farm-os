import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/types";

/** Pool of flowers used for per-order accents in the history list. */
const HISTORY_FLOWERS = [
  "squash-blossom", "nasturtium", "marigold", "gem-marigold",
  "pansy", "pea-flower", "chive-blossom", "borage", "calendula",
  "chamomile", "lavender", "alyssum", "hairy-vetch", "fava-flower",
  "anise-hyssop", "bachelor-button", "thyme", "rosemary", "dill",
];

/** Stable hash from an order ID -> non-negative int (so each order gets a consistent flower). */
function hashOrderId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

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
      <main className="min-h-screen bg-farm-cream">
        <header className="page-header">
          <h1 className="page-title">Order History</h1>
        </header>
        <div className="flex items-center justify-center h-64 px-4">
          <p className="text-center text-gray-500 text-sm">
            No restaurant found. Please contact Press Farm.
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
    <main className="min-h-screen bg-farm-cream pb-20">
      <header className="page-header">
        <h1 className="page-title">Order History</h1>
        <p className="text-sm text-gray-500">{restaurant.name}</p>
      </header>

      <div className="px-4 py-4">
        {!orders || orders.length === 0 ? (
          <div className="text-center py-12">
            <img
              src="/assets/pressfarm/flowers/squash-bud.png"
              alt=""
              aria-hidden="true"
              className="mx-auto h-24 w-auto mb-4 opacity-90"
            />
            <h3 className="text-base font-semibold text-farm-dark">No past orders yet</h3>
            <p className="text-sm text-gray-400 mt-1.5 max-w-sm mx-auto">
              Once you place an order, it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {orders.map((order: any) => {
              const itemCount = order.order_items?.length ?? 0;
              const status = order.status as OrderStatus;
              const flower = HISTORY_FLOWERS[hashOrderId(order.id) % HISTORY_FLOWERS.length];

              return (
                <li key={order.id}>
                  <Link
                    href={`/history/${order.id}`}
                    className="flex items-center gap-3 card-interactive px-4 py-3 min-h-[64px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-farm-cream border border-farm-dark/5 flex items-center justify-center flex-shrink-0">
                      <img
                        src={`/assets/pressfarm/flowers/${flower}.png`}
                        alt=""
                        aria-hidden="true"
                        className="w-9 h-9 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-farm-dark">
                        {formatDeliveryDate(order.delivery_date)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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
    draft: "badge-gray",
    submitted: "badge-blue",
    in_progress: "badge-gold",
    fulfilled: "badge-green",
    cancelled: "badge-red",
  };

  return (
    <span className={colors[status] ?? "badge-gray"}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
