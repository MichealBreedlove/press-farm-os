import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import FinalizeButton from "../FinalizeButton";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default async function AdminFinalizeMonthPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = monthParam ?? today.slice(0, 7);
  const [year, mon] = currentMonth.split("-").map(Number);
  const start = `${currentMonth}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  // Prev / next month nav
  const prevDate = new Date(year, mon - 2, 1);
  const nextDate = new Date(year, mon, 1);
  const prevMonth = prevDate.toISOString().slice(0, 7);
  const nextMonth = nextDate.toISOString().slice(0, 7);
  const isCurrentMonth = currentMonth === today.slice(0, 7);

  const admin = createAdminClient();

  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select(`
      id, delivery_date, status, total_value, notes,
      restaurants ( name ),
      delivery_items ( id, quantity, unit, unit_price, line_total, items ( name ) )
    `)
    .gte("delivery_date", start)
    .lte("delivery_date", end)
    .order("delivery_date", { ascending: true });

  const rows = deliveries ?? [];
  const logged = rows.filter((d: any) => d.status === "logged");
  const finalized = rows.filter((d: any) => d.status === "finalized");
  const allFinalized = rows.length > 0 && logged.length === 0;
  const grandTotal = rows.reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);
  const loggedTotal = logged.reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/deliveries"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Finalize Month</h1>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mt-2">
          <Link
            href={`/admin/deliveries/finalize?month=${prevMonth}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-gray-900">{monthLabel}</span>
          <Link
            href={isCurrentMonth ? "#" : `/admin/deliveries/finalize?month=${nextMonth}`}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
              isCurrentMonth ? "text-gray-200" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Summary card */}
        <div className={`rounded-2xl p-5 text-white ${allFinalized ? "bg-gray-700" : "bg-farm-green"}`}>
          <p className="text-sm opacity-75">{monthLabel} Total</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(grandTotal)}</p>
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="opacity-75">
              {rows.length} delivery{rows.length !== 1 ? "s" : ""}
              {logged.length > 0 && ` · ${logged.length} unfinalized`}
            </span>
            {allFinalized ? (
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">All Finalized</span>
            ) : logged.length > 0 ? (
              <FinalizeButton month={currentMonth} />
            ) : null}
          </div>
        </div>

        {/* Status breakdown */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3">
              <p className="text-xs text-gray-500">Logged</p>
              <p className="text-lg font-bold text-farm-dark">{logged.length}</p>
              <p className="text-xs text-farm-green mt-0.5">{formatCurrency(loggedTotal)}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-gray-500">Finalized</p>
              <p className="text-lg font-bold text-gray-900">{finalized.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatCurrency(finalized.reduce((s: number, d: any) => s + (d.total_value ?? 0), 0))}
              </p>
            </div>
          </div>
        )}

        {/* Delivery list */}
        {rows.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Deliveries ({rows.length})
            </h2>
            {rows.map((d: any) => (
              <Link
                key={d.id}
                href={`/admin/deliveries/${d.delivery_date}`}
                className="block card-interactive p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{formatDate(d.delivery_date)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{d.restaurants?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(d.delivery_items ?? []).length} items
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(d.total_value ?? 0)}
                    </p>
                    <span className={d.status === "finalized" ? "badge-gray" : "badge-green"}>
                      {d.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400 py-8">
            No deliveries logged for {monthLabel}.
          </p>
        )}
      </div>
    </main>
  );
}
