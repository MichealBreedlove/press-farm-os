import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import FinalizeButton from "./FinalizeButton";
import { CalendarView } from "./CalendarView";
import { LogPastDelivery } from "./LogPastDelivery";
import { GenerateDatesButton } from "./GenerateDatesButton";
import { ViewToggle } from "./ViewToggle";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrency } from "@/lib/utils";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function monthLabel(d: string) {
  const [y, m] = d.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: filterMonth } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Upcoming delivery dates (for "Log Delivery" links)
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingDates } = await admin
    .from("delivery_dates")
    .select("date, ordering_open")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(6);

  // All logged deliveries, most recent first
  // If a month filter is provided, only return that month
  let deliveriesQuery = admin
    .from("deliveries")
    .select(`
      id, delivery_date, status, total_value,
      restaurants ( name )
    `)
    .order("delivery_date", { ascending: false });

  if (filterMonth && /^\d{4}-\d{2}$/.test(filterMonth)) {
    const [y, m] = filterMonth.split("-").map(Number);
    const start = `${filterMonth}-01`;
    const end = `${filterMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    deliveriesQuery = deliveriesQuery.gte("delivery_date", start).lte("delivery_date", end);
  } else {
    deliveriesQuery = deliveriesQuery.limit(60);
  }

  const { data: deliveries } = await deliveriesQuery;

  // Current month totals
  const currentMonth = today.slice(0, 7);
  const monthDeliveries = (deliveries ?? []).filter(
    (d: any) => d.delivery_date.startsWith(currentMonth)
  );
  const monthTotal = monthDeliveries.reduce(
    (sum: number, d: any) => sum + (d.total_value ?? 0),
    0
  );
  const allFinalized = monthDeliveries.length > 0 &&
    monthDeliveries.every((d: any) => d.status === "finalized");
  // Logged deliveries still at $0 (no items) — warn before the month is locked.
  const monthEmptyCount = monthDeliveries.filter(
    (d: any) => d.status === "logged" && (d.total_value ?? 0) === 0
  ).length;

  // Group by YYYY-MM
  const grouped: Record<string, any[]> = {};
  for (const d of deliveries ?? []) {
    const key = d.delivery_date.slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  }

  // Dates already logged (set of delivery_date strings)
  const loggedDates = new Set((deliveries ?? []).map((d: any) => d.delivery_date));

  // Calendar data
  const calendarDeliveries = (deliveries ?? []).map((d: any) => ({
    date: d.delivery_date,
    total: d.total_value ?? 0,
    status: d.status,
    restaurant: d.restaurants?.name ?? "",
  }));
  const calendarDates = (upcomingDates ?? []).map((d: any) => d.date);

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Deliveries</h1>
      </header>
      <EditorialHero
        eyebrow="Daily Operations"
        title="Deliveries"
        subtitle={`${monthLabel(today)} · ${formatCurrency(monthTotal)} across ${monthDeliveries.length} ${monthDeliveries.length === 1 ? "delivery" : "deliveries"}`}
        flower="marigold"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        {filterMonth && (
          <div className="bg-farm-cream/60 border border-farm-green/15 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <p className="text-sm text-farm-green">
              Filtered to <span className="font-semibold">{monthLabel(filterMonth + "-01")}</span>
            </p>
            <Link href="/admin/deliveries" className="text-xs text-farm-green hover:text-farm-dark font-medium min-h-[36px] px-2 py-1.5">
              Clear filter
            </Link>
          </div>
        )}
        {/* Current month summary card */}
        <div className="card-success">
          <p className="section-eyebrow with-flower text-white/70">{monthLabel(today)} Total</p>
          <p className="text-3xl font-bold mt-2">{formatCurrency(monthTotal)}</p>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-white/80">
              {monthDeliveries.length} delivery{monthDeliveries.length !== 1 ? "s" : ""} logged
            </p>
            {monthDeliveries.length > 0 && !allFinalized && (
              <FinalizeButton month={currentMonth} emptyCount={monthEmptyCount} />
            )}
            {allFinalized && (
              <span className="badge-green">Finalized</span>
            )}
          </div>
        </div>

        {/* Calendar / List toggle */}
        <ViewToggle
          calendarView={
            <CalendarView deliveries={calendarDeliveries} deliveryDates={calendarDates} />
          }
          listView={
            Object.keys(grouped).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(grouped)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([month, entries]) => {
                    const total = entries.reduce(
                      (sum, d) => sum + (d.total_value ?? 0),
                      0
                    );
                    return (
                      <div key={month}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-farm-dark/80">
                            {monthLabel(month + "-01")}
                          </p>
                          <p className="text-sm font-semibold text-farm-dark">
                            {formatCurrency(total)}
                          </p>
                        </div>
                        <div className="bg-white border border-farm-dark/5 rounded-xl overflow-hidden shadow-sm">
                          {entries.map((d: any, i: number) => (
                            <Link
                              key={d.id}
                              href={`/admin/deliveries/${d.delivery_date}`}
                              className={`flex items-center justify-between px-4 py-3 ${
                                i < entries.length - 1 ? "border-b border-gray-50" : ""
                              }`}
                            >
                              <div>
                                <p className="text-sm text-farm-dark">
                                  {formatDate(d.delivery_date)}
                                </p>
                                <p className="text-xs text-farm-muted mt-0.5">
                                  {d.restaurants?.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-medium text-farm-dark">
                                    {formatCurrency(d.total_value ?? 0)}
                                  </p>
                                  <p className={`text-xs ${
                                    d.status === "finalized"
                                      ? "text-farm-muted"
                                      : "text-farm-green"
                                  }`}>
                                    {d.status}
                                  </p>
                                </div>
                                <svg className="w-4 h-4 text-farm-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <EmptyState
                flower="calendula"
                title="No deliveries logged yet"
                body="Pick an upcoming date below to log your first delivery."
              />
            )
          }
        />

        {/* Upcoming dates needing log entry */}
        {upcomingDates && upcomingDates.length > 0 && (
          <section>
            <p className="section-eyebrow with-flower text-farm-muted mb-3">Log a Delivery</p>
            <div className="space-y-2">
              {(upcomingDates as any[]).map((d: any) => (
                <Link
                  key={d.date}
                  href={`/admin/deliveries/${d.date}`}
                  className="flex items-center justify-between card px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-farm-dark">
                      {formatDate(d.date)}
                    </p>
                    {loggedDates.has(d.date) && (
                      <p className="text-xs text-farm-green mt-0.5">Logged</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {loggedDates.has(d.date) ? (
                      <span className="text-xs text-farm-muted">Edit</span>
                    ) : (
                      <span className="badge-green">
                        + Log
                      </span>
                    )}
                    <svg className="w-4 h-4 text-farm-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Generate delivery dates + Log past delivery */}
        <GenerateDatesButton />
        <LogPastDelivery />

        {/* Combined Import / Export — bulk delivery history I/O */}
        <Link
          href="/admin/deliveries/data"
          className="block w-full min-h-[48px] mt-2 rounded-xl border border-farm-dark/10 text-sm font-medium text-farm-dark/85 bg-white hover:border-farm-green hover:text-farm-green transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Import / Export
        </Link>

      </div>
    </main>
  );
}
