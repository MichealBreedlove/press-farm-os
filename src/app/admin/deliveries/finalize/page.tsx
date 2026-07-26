import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import FinalizeButton from "../FinalizeButton";
import { formatCurrency, todayPacific } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ month?: string }>;
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

  const today = todayPacific();
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
  const fmtMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = fmtMonth(prevDate);
  const nextMonth = fmtMonth(nextDate);
  const isCurrentMonth = currentMonth === today.slice(0, 7);

  const admin = createAdminClient();

  const { data: deliveries } = await admin
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
  // Logged deliveries still sitting at $0 — almost always an un-logged
  // delivery (items never entered). Finalizing locks them in and silently
  // under-counts the month, so surface them before the irreversible step.
  const emptyLogged = logged.filter((d: any) => (d.total_value ?? 0) === 0);

  return (
    <main className="pb-24">
      <header className="page-header no-wordmark">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/deliveries"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-farm-muted"
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-farm-muted hover:text-farm-dark"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-farm-dark">{monthLabel}</span>
          <Link
            href={isCurrentMonth ? "#" : `/admin/deliveries/finalize?month=${nextMonth}`}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
              isCurrentMonth ? "text-gray-200" : "text-farm-muted hover:text-farm-dark"
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
              <FinalizeButton month={currentMonth} emptyCount={emptyLogged.length} />
            ) : null}
          </div>
        </div>

        {/* Empty-delivery guard — don't lock in $0 by accident */}
        {emptyLogged.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-amber-800">
              {emptyLogged.length} {emptyLogged.length === 1 ? "delivery has" : "deliveries have"} no
              items — finalizing locks {emptyLogged.length === 1 ? "it" : "them"} in at $0
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Log {emptyLogged.length === 1 ? "it" : "them"} first, or the month under-counts revenue.
            </p>
            <div className="mt-2 space-y-1">
              {emptyLogged.map((d: any) => (
                <Link
                  key={d.id}
                  href={`/admin/deliveries/${d.delivery_date}`}
                  className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2 text-xs text-amber-800 hover:text-amber-900"
                >
                  <span>{formatDate(d.delivery_date)} · {d.restaurants?.name}</span>
                  <span className="font-medium">Log items →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Status breakdown */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3">
              <p className="text-xs text-farm-muted">Logged</p>
              <p className="text-lg font-bold text-farm-dark">{logged.length}</p>
              <p className="text-xs text-farm-green mt-0.5">{formatCurrency(loggedTotal)}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-farm-muted">Finalized</p>
              <p className="text-lg font-bold text-farm-dark">{finalized.length}</p>
              <p className="text-xs text-farm-muted mt-0.5">
                {formatCurrency(finalized.reduce((s: number, d: any) => s + (d.total_value ?? 0), 0))}
              </p>
            </div>
          </div>
        )}

        {/* Delivery list */}
        {rows.length > 0 ? (
          <div className="space-y-2">
            <p className="section-eyebrow with-flower text-farm-muted">
              Deliveries ({rows.length})
            </p>
            {rows.map((d: any) => (
              <Link
                key={d.id}
                href={`/admin/deliveries/${d.delivery_date}`}
                className="block card-interactive p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-farm-dark">{formatDate(d.delivery_date)}</p>
                    <p className="text-xs text-farm-muted mt-0.5">{d.restaurants?.name}</p>
                    <p className="text-xs text-farm-muted mt-0.5">
                      {(d.delivery_items ?? []).length} items
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-farm-dark">
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
          <p className="text-center text-sm text-farm-muted py-8">
            No deliveries logged for {monthLabel}.
          </p>
        )}
      </div>
    </main>
  );
}

