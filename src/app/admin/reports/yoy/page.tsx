import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "@/components/shared/PrintButton";
import { EditorialHero } from "@/components/shared/EditorialHero";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(curr: number, prev: number): { text: string; color: string } {
  if (prev === 0) {
    if (curr === 0) return { text: "—", color: "text-farm-muted" };
    return { text: "new", color: "text-farm-green" };
  }
  const diff = ((curr - prev) / prev) * 100;
  if (Math.abs(diff) < 0.5) return { text: "≈", color: "text-farm-muted" };
  return {
    text: `${diff > 0 ? "+" : ""}${diff.toFixed(0)}%`,
    color: diff > 0 ? "text-farm-green" : "text-red-500",
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * /admin/reports/yoy — Year-over-year comparison
 */
export default async function YoYReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Fetch all delivery and expense data
  const [{ data: deliveries }, { data: expenses }] = await Promise.all([
    admin.from("deliveries").select("delivery_date, total_value"),
    admin.from("farm_expenses").select("date, amount"),
  ]);

  // Aggregate by year, then by month
  type YearMonths = Record<number, Record<number, { revenue: number; expenses: number }>>;
  const data: YearMonths = {};

  for (const d of deliveries ?? []) {
    const date = new Date(d.delivery_date + "T12:00:00");
    const y = date.getFullYear();
    const m = date.getMonth();
    if (!data[y]) data[y] = {};
    if (!data[y][m]) data[y][m] = { revenue: 0, expenses: 0 };
    data[y][m].revenue += d.total_value ?? 0;
  }

  for (const e of expenses ?? []) {
    const date = new Date(e.date + "T12:00:00");
    const y = date.getFullYear();
    const m = date.getMonth();
    if (!data[y]) data[y] = {};
    if (!data[y][m]) data[y][m] = { revenue: 0, expenses: 0 };
    data[y][m].expenses += e.amount ?? 0;
  }

  const years = Object.keys(data).map(Number).sort();
  const currentYear = new Date().getFullYear();
  const yearsToCompare = years.filter((y) => y >= currentYear - 1).slice(-2);
  const [prevYear, currYear] = yearsToCompare.length === 2 ? yearsToCompare : [yearsToCompare[0] - 1, yearsToCompare[0]];

  // Year totals
  const yearTotal = (y: number, key: "revenue" | "expenses") =>
    Object.values(data[y] ?? {}).reduce((s, m) => s + (m as any)[key], 0);

  const currRev = yearTotal(currYear, "revenue");
  const prevRev = yearTotal(prevYear, "revenue");
  const currExp = yearTotal(currYear, "expenses");
  const prevExp = yearTotal(prevYear, "expenses");

  const revPct = pct(currRev, prevRev);
  const expPct = pct(currExp, prevExp);

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">←</Link>
          <div className="flex-1">
            <h1 className="page-title">Year over Year</h1>
            <p className="text-xs text-white/60">{prevYear} vs {currYear}</p>
          </div>
          <div className="ml-auto"><PrintButton /></div>
        </div>
      </header>
      <EditorialHero
        eyebrow="By the Numbers"
        title="Year over Year"
        subtitle="Revenue + expense change by month and quarter"
        flower="green-leaf"
        backHref="/admin/reports"
      />

      <div className="px-4 py-5 space-y-6">
        {/* Year totals */}
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-3">Annual Totals</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs text-farm-muted">Revenue</p>
              <p className="text-2xl font-bold text-farm-green mt-1">{formatCurrency(currRev)}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-xs text-farm-muted">vs {formatCurrency(prevRev)}</p>
                <span className={`text-xs font-semibold ${revPct.color}`}>{revPct.text}</span>
              </div>
            </div>
            <div className="card p-4">
              <p className="text-xs text-farm-muted">Expenses</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(currExp)}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-xs text-farm-muted">vs {formatCurrency(prevExp)}</p>
                <span className={`text-xs font-semibold ${expPct.color}`}>{expPct.text}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Monthly comparison */}
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-3">Monthly Revenue</p>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 px-4 py-2 bg-farm-cream/40 text-[10px] font-semibold text-farm-muted uppercase">
              <div>Month</div>
              <div className="text-right">{prevYear}</div>
              <div className="text-right">{currYear}</div>
              <div className="text-right">Δ</div>
            </div>
            {MONTH_NAMES.map((label, i) => {
              const prevVal = data[prevYear]?.[i]?.revenue ?? 0;
              const currVal = data[currYear]?.[i]?.revenue ?? 0;
              const delta = pct(currVal, prevVal);
              const hasData = prevVal > 0 || currVal > 0;
              if (!hasData) return null;
              return (
                <div key={i} className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 px-4 py-2.5 border-b border-gray-50 last:border-0 items-center">
                  <div className="text-sm font-medium text-farm-dark/80">{label}</div>
                  <div className="text-right text-sm text-farm-muted">{prevVal > 0 ? formatCurrency(prevVal) : "—"}</div>
                  <div className="text-right text-sm font-semibold text-farm-dark">{currVal > 0 ? formatCurrency(currVal) : "—"}</div>
                  <div className={`text-right text-xs font-semibold ${delta.color}`}>{delta.text}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quarterly comparison */}
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-3">Quarterly Revenue</p>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 px-4 py-2 bg-farm-cream/40 text-[10px] font-semibold text-farm-muted uppercase">
              <div>Quarter</div>
              <div className="text-right">{prevYear}</div>
              <div className="text-right">{currYear}</div>
              <div className="text-right">Δ</div>
            </div>
            {[0, 1, 2, 3].map((q) => {
              const months = [q * 3, q * 3 + 1, q * 3 + 2];
              const prevVal = months.reduce((s, m) => s + (data[prevYear]?.[m]?.revenue ?? 0), 0);
              const currVal = months.reduce((s, m) => s + (data[currYear]?.[m]?.revenue ?? 0), 0);
              const delta = pct(currVal, prevVal);
              const hasData = prevVal > 0 || currVal > 0;
              if (!hasData) return null;
              return (
                <div key={q} className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 px-4 py-2.5 border-b border-gray-50 last:border-0 items-center">
                  <div className="text-sm font-medium text-farm-dark/80">Q{q + 1}</div>
                  <div className="text-right text-sm text-farm-muted">{prevVal > 0 ? formatCurrency(prevVal) : "—"}</div>
                  <div className="text-right text-sm font-semibold text-farm-dark">{currVal > 0 ? formatCurrency(currVal) : "—"}</div>
                  <div className={`text-right text-xs font-semibold ${delta.color}`}>{delta.text}</div>
                </div>
              );
            })}
          </div>
        </section>

        {years.length < 2 && (
          <p className="text-center text-sm text-farm-muted py-4">
            Need at least 2 years of data for full YoY comparison.
          </p>
        )}
      </div>
    </main>
  );
}
