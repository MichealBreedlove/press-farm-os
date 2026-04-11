import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import FinalizeButton from "./FinalizeButton";
import { CalendarView } from "./CalendarView";
import { LogPastDelivery } from "./LogPastDelivery";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

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

export default async function AdminDeliveriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Upcoming delivery dates (for "Log Delivery" links)
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingDates } = await (admin as any)
    .from("delivery_dates")
    .select("date, ordering_open")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(6);

  // All logged deliveries, most recent first
  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select(`
      id, delivery_date, status, total_value,
      restaurants ( name )
    `)
    .order("delivery_date", { ascending: false })
    .limit(60);

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

      <div className="px-4 py-4 space-y-4">
        {/* Current month summary card */}
        <div className="bg-farm-green text-white rounded-2xl p-5">
          <p className="text-sm text-farm-green-light">{monthLabel(today)} Total</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(monthTotal)}</p>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-farm-green-light">
              {monthDeliveries.length} delivery{monthDeliveries.length !== 1 ? "s" : ""} logged
            </p>
            {monthDeliveries.length > 0 && !allFinalized && (
              <FinalizeButton month={currentMonth} />
            )}
            {allFinalized && (
              <span className="badge-green">
                Finalized
              </span>
            )}
          </div>
        </div>

        {/* Calendar view */}
        <CalendarView deliveries={calendarDeliveries} deliveryDates={calendarDates} />

        {/* Upcoming dates needing log entry */}
        {upcomingDates && upcomingDates.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Log a Delivery
            </h2>
            <div className="space-y-2">
              {(upcomingDates as any[]).map((d: any) => (
                <Link
                  key={d.date}
                  href={`/admin/deliveries/${d.date}`}
                  className="flex items-center justify-between card px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(d.date)}
                    </p>
                    {loggedDates.has(d.date) && (
                      <p className="text-xs text-farm-green mt-0.5">Logged</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {loggedDates.has(d.date) ? (
                      <span className="text-xs text-gray-400">Edit</span>
                    ) : (
                      <span className="badge-green">
                        + Log
                      </span>
                    )}
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Log past delivery */}
        <LogPastDelivery />

        {/* Delivery history */}
        {Object.keys(grouped).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              History
            </h2>
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
                        <p className="text-sm font-medium text-gray-700">
                          {monthLabel(month + "-01")}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(total)}
                        </p>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                        {entries.map((d: any, i: number) => (
                          <Link
                            key={d.id}
                            href={`/admin/deliveries/${d.delivery_date}`}
                            className={`flex items-center justify-between px-4 py-3 ${
                              i < entries.length - 1 ? "border-b border-gray-50" : ""
                            }`}
                          >
                            <div>
                              <p className="text-sm text-gray-900">
                                {formatDate(d.delivery_date)}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {d.restaurants?.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">
                                  {formatCurrency(d.total_value ?? 0)}
                                </p>
                                <p className={`text-xs ${
                                  d.status === "finalized"
                                    ? "text-gray-400"
                                    : "text-farm-green"
                                }`}>
                                  {d.status}
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          </section>
        )}

        {Object.keys(grouped).length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            No deliveries logged yet
          </p>
        )}
      </div>
    </main>
  );
}
