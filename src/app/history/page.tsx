import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/types";
import { HistoryFilters } from "./HistoryFilters";
import { EmptyState } from "@/components/shared/EmptyState";
import { SignOutButton } from "@/components/shared/SignOutButton";

const STATUS_FILTERS: OrderStatus[] = ["submitted", "in_progress", "fulfilled", "cancelled"];

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
  searchParams: Promise<{ page?: string; status?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const statusFilter = STATUS_FILTERS.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const monthFilter = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
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
          <p className="text-center text-farm-muted text-sm">
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
  let query = supabase
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
    .eq("restaurant_id", restaurant.id);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (monthFilter) {
    const [y, m] = monthFilter.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    query = query.gte("delivery_date", `${monthFilter}-01`).lte("delivery_date", `${monthFilter}-${String(last).padStart(2, "0")}`);
  }
  const { data: rows } = await query
    .order("delivery_date", { ascending: false })
    .range(from, to) as any;

  // Months that have orders — for the month picker. Bounded: one column,
  // newest 400 orders, deduped to YYYY-MM.
  const { data: monthRows } = await supabase
    .from("orders")
    .select("delivery_date")
    .eq("restaurant_id", restaurant.id)
    .order("delivery_date", { ascending: false })
    .limit(400) as any;
  const months: string[] = Array.from(
    new Set(((monthRows ?? []) as Array<{ delivery_date: string }>).map((r) => r.delivery_date.slice(0, 7))),
  );
  const filterQs = (over: { status?: string | null; month?: string | null; page?: number }) => {
    const p = new URLSearchParams();
    const st = over.status === undefined ? statusFilter : over.status;
    const mo = over.month === undefined ? monthFilter : over.month;
    if (st) p.set("status", st);
    if (mo) p.set("month", mo);
    if (over.page && over.page > 1) p.set("page", String(over.page));
    const q = p.toString();
    return q ? `/history?${q}` : "/history";
  };

  const hasNext = (rows?.length ?? 0) > PAGE_SIZE;
  const orders = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
  const hasPrev = page > 1;

  return (
    <main className="min-h-screen bg-farm-cream pb-20">
      <header className="page-header">
        <h1 className="page-title">Order History</h1>
        <p className="text-sm text-white/80">{restaurant.name}</p>
      </header>

      <div className="px-4 py-4">
        <HistoryFilters
          statusFilter={statusFilter}
          monthFilter={monthFilter}
          months={months}
          statusOptions={STATUS_FILTERS.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] ?? s }))}
        />
        {!orders || orders.length === 0 ? (
          statusFilter || monthFilter ? (
            <EmptyState
              flower="squash-bud"
              title="No orders match this filter"
              cta={{ label: "Clear filters", href: "/history" }}
            />
          ) : (
            <EmptyState
              flower="squash-bud"
              title="No past orders yet"
              body="Once you place an order, it'll show up here."
              cta={{ label: "Place an order", href: "/order" }}
            />
          )
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
                href={filterQs({ page: page - 1 })}
                className="btn-ghost bg-white border border-farm-dark/10 text-sm px-4 py-2.5 min-h-[44px] inline-flex items-center"
              >
                ‹ Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-farm-muted">Page {page}</span>
            {hasNext ? (
              <Link
                href={filterQs({ page: page + 1 })}
                className="btn-ghost bg-white border border-farm-dark/10 text-sm px-4 py-2.5 min-h-[44px] inline-flex items-center"
              >
                Older ›
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        {/* Sign-out lives here (not in the tab bar) so a mis-tap while
            ordering can't drop a chef out mid-order. */}
        <div className="mt-8">
          <SignOutButton />
        </div>
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
