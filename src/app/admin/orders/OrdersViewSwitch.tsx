import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";

/**
 * Segmented "By date | Explore" switch at the top of /admin/orders.
 * Plain links: each view is a server render keyed off ?view=.
 */
export function OrdersViewSwitch({ view, dateParam }: { view: "date" | "explore"; dateParam?: string }) {
  const dateHref = dateParam ? `/admin/orders?date=${dateParam}` : "/admin/orders";
  const base = "flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] text-sm font-medium rounded-lg transition-colors";
  return (
    <div className="flex bg-farm-cream/60 rounded-xl p-1" role="tablist" aria-label="Orders view">
      <Link
        href={dateHref}
        role="tab"
        aria-selected={view === "date"}
        className={`${base} ${view === "date" ? "bg-white text-farm-dark shadow-sm" : "text-farm-muted hover:text-farm-dark/80"}`}
      >
        <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
        By date
      </Link>
      <Link
        href="/admin/orders?view=explore"
        role="tab"
        aria-selected={view === "explore"}
        className={`${base} ${view === "explore" ? "bg-white text-farm-dark shadow-sm" : "text-farm-muted hover:text-farm-dark/80"}`}
      >
        <Search className="w-4 h-4" strokeWidth={1.75} />
        Explore
      </Link>
    </div>
  );
}
