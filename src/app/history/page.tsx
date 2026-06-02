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

/** Orders shown per page in the history list. */
const PAGE_SIZE = 50;

/**
 * /history — Chef order history list (Server Component)
 *
 * Fetches the chef's past orders, most recent first, paginated so the list
 * stays bounded as order volume grows.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  // Fetch one extra row to detect whether a next page exists without a count.
  const to = from + PAGE_SIZE;

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

  // Fetch all orders with item count + shortage flag so the list row
  // can surface a "1 shortage" caption inline — chefs can spot problem
  // orders without opening each one.
  const { data: rows } = await supabase
    .from("orders")
    .select(`
      id,
      delivery_date,
      status,
      submitted_at,
      created_at,
      last_edited_by,
      last_edited_at,
      chef:profiles!orders_chef_id_fkey(id, full_name),
      edited_by:profiles!orders_last_edited_by_fkey(id, full_name),
      order_items(id, is_shorted)
    `)
    .eq("restaurant_id", restaurant.id)
    .order("delivery_date", { ascending: false })
    .range(from, to) as any;

  const hasNext = (rows?.length ?? 0) > PAGE_SIZE;
  const orders = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
  const hasPrev = page > 1;

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
              const shortedCount = (order.order_items ?? []).filter((oi: any) => oi.is_shorted).length;
              const status = order.status as OrderStatus;
              const flower = HISTORY_FLOWERS[hashOrderId(order.id) % HISTORY_FLOWERS.length];

              // Accountability line: who placed it, and who last touched it if
              // that's a different person. Names are snapshots via the profile
              // joins above; fall back gracefully when a profile is missing.
              const placedBy = order.chef?.full_name ?? null;
              const editedBy = order.edited_by?.full_name ?? null;
              const showEditedBy =
                editedBy && order.last_edited_by && order.last_edited_by !== order.chef?.id;

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
                      <p className="text-xs text-farm-muted mt-0.5">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                        {shortedCount > 0 && (
                          <span className="ml-1.5 text-pf-master-orange font-medium">
                            · {shortedCount} short
                          </span>
                        )}
                      </p>
                      {placedBy && (
                        <p className="text-[11px] text-farm-muted/80 mt-0.5 truncate">
                          Placed by {placedBy}
                          {showEditedBy && (
                            <span> · edited by {editedBy}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusPill status={status} />
                      <span className="text-farm-muted/60 text-lg">›</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {(hasPrev || hasNext) && (
          <nav className="flex items-center justify-between gap-3 mt-5" aria-label="Order history pages">
            {hasPrev ? (
              <Link
                href={`/history?page=${page - 1}`}
                className="btn-ghost bg-gray-50 hover:bg-gray-100 text-sm px-4 py-2.5 min-h-[44px] inline-flex items-center"
              >
                ‹ Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-farm-muted">Page {page}</span>
            {hasNext ? (
              <Link
                href={`/history?page=${page + 1}`}
                className="btn-ghost bg-gray-50 hover:bg-gray-100 text-sm px-4 py-2.5 min-h-[44px] inline-flex items-center"
              >
                Older ›
              </Link>
            ) : (
              <span />
            )}
          </nav>
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
