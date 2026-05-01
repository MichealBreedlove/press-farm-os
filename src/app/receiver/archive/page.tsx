import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { formatDeliveryDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * /receiver/archive — Past deliveries archive.
 *
 * The main /receiver dashboard's date strip only covers the last 7 + next 7
 * days. This page is for reaching back further: a chronological list of
 * every past delivery date that had at least one order or delivery, grouped
 * by month, with a quick stat on items received.
 */
export default async function ReceiverArchivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.role !== "receiver" && profile.role !== "admin") redirect("/order");

  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();

  // Pull the universe of past delivery dates that had any activity.
  // Two queries because we want either signal to count: an order was
  // placed OR a delivery was logged. Then merge + dedupe.
  const [{ data: pastOrders }, { data: pastDeliveries }] = await Promise.all([
    (admin as any)
      .from("orders")
      .select("delivery_date")
      .lt("delivery_date", today)
      .order("delivery_date", { ascending: false })
      .limit(500),
    (admin as any)
      .from("deliveries")
      .select("delivery_date, total_value")
      .lt("delivery_date", today)
      .order("delivery_date", { ascending: false })
      .limit(500),
  ]);

  // Aggregate per-date stats
  const byDate = new Map<string, { date: string; orderCount: number; deliveryCount: number; deliveryTotal: number }>();
  function ensure(date: string) {
    let row = byDate.get(date);
    if (!row) {
      row = { date, orderCount: 0, deliveryCount: 0, deliveryTotal: 0 };
      byDate.set(date, row);
    }
    return row;
  }
  for (const o of (pastOrders ?? []) as any[]) ensure(o.delivery_date).orderCount++;
  for (const d of (pastDeliveries ?? []) as any[]) {
    const row = ensure(d.delivery_date);
    row.deliveryCount++;
    row.deliveryTotal += Number(d.total_value ?? 0);
  }

  const dates = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));

  // Group by year-month for visual headers
  const byMonth = new Map<string, typeof dates>();
  for (const d of dates) {
    const key = d.date.slice(0, 7); // YYYY-MM
    const list = byMonth.get(key) ?? [];
    list.push(d);
    byMonth.set(key, list);
  }
  const monthKeys = Array.from(byMonth.keys()); // already in DESC order from sort above

  return (
    <main className="min-h-screen pb-24 bg-farm-cream">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/receiver" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Archive</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Past Deliveries"
        title="Archive"
        subtitle={dates.length > 0
          ? `${dates.length} past delivery date${dates.length === 1 ? "" : "s"}`
          : "Older deliveries will show up here"}
        flower="rosemary"
        backHref="/receiver"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {dates.length === 0 ? (
          <div className="text-center py-12 bg-white border border-farm-dark/5 rounded-2xl shadow-sm">
            <img
              src="/assets/pressfarm/flowers/rosemary.png"
              alt=""
              aria-hidden="true"
              className="mx-auto h-20 w-auto mb-4 opacity-90"
            />
            <p className="font-display text-lg text-farm-dark">Nothing in the archive yet</p>
            <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">
              Past deliveries appear here as they roll off the live dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {monthKeys.map((monthKey) => {
              const monthDates = byMonth.get(monthKey)!;
              const [y, m] = monthKey.split("-").map(Number);
              const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });

              return (
                <section key={monthKey}>
                  <p className="section-eyebrow text-farm-muted mb-3 px-1">
                    {monthLabel}
                  </p>
                  <ul className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden divide-y divide-farm-dark/5">
                    {monthDates.map((d) => {
                      const dt = new Date(d.date + "T00:00:00");
                      const dayLabel = dt.toLocaleDateString("en-US", { weekday: "short" });
                      const dateLabel = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      return (
                        <li key={d.date}>
                          <Link
                            href={`/receiver?date=${d.date}`}
                            className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-farm-cream/40 transition-colors min-h-[64px]"
                          >
                            <div>
                              <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">{dayLabel}</p>
                              <p className="font-display text-base text-farm-dark mt-0.5">{dateLabel}</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-farm-muted">
                              {d.orderCount > 0 && (
                                <span>{d.orderCount} order{d.orderCount === 1 ? "" : "s"}</span>
                              )}
                              {d.deliveryCount > 0 && d.orderCount > 0 && (
                                <span className="text-farm-muted/40">·</span>
                              )}
                              {d.deliveryCount > 0 && (
                                <span>{d.deliveryCount} deliver{d.deliveryCount === 1 ? "y" : "ies"}</span>
                              )}
                              <svg className="w-4 h-4 text-farm-muted/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
