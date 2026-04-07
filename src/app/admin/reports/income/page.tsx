import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar",
  "04": "Apr", "05": "May", "06": "Jun",
  "07": "Jul", "08": "Aug", "09": "Sep",
  "10": "Oct", "11": "Nov", "12": "Dec",
};

// Farmer pay is a fixed operating expense, $12K per quarter
const FARMER_PAY_PER_QUARTER = 12000;

// Industry benchmarks for market farms
const BENCHMARKS = {
  grossMargin: { label: "Gross Margin", range: "50–70%", min: 0.5, max: 0.7 },
  operatingMargin: { label: "Operating Margin", range: "30–50%", min: 0.3, max: 0.5 },
  netMargin: { label: "Net Margin", range: "20–40%", min: 0.2, max: 0.4 },
  acreProduction: { label: "Production / Acre", national: 100000 },
};

const FARM_ACRES = 0.5;

function fmt(n: number) {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${str})` : `$${str}`;
}

function pct(n: number, total: number) {
  if (!total) return "—";
  return ((n / total) * 100).toFixed(1) + "%";
}

function marginColor(value: number, min: number, max: number) {
  if (value >= min) return "text-farm-green";
  if (value >= min * 0.7) return "text-amber-600";
  return "text-red-600";
}

export default async function AdminIncomeStatementPage({ searchParams }: Props) {
  const { year: yearParam, quarter: quarterParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const now = new Date();

  // Default to most recent quarter with data
  let year = parseInt(yearParam ?? "0");
  let quarter = parseInt(quarterParam ?? "0");

  if (!yearParam || !quarterParam) {
    // Find most recent quarter with delivery data
    const { data: latestDelivery } = await (admin as any)
      .from("deliveries")
      .select("delivery_date")
      .order("delivery_date", { ascending: false })
      .limit(1)
      .single();

    if (latestDelivery?.delivery_date) {
      const d = new Date(latestDelivery.delivery_date);
      year = d.getFullYear();
      quarter = Math.ceil((d.getMonth() + 1) / 3);
    } else {
      year = now.getFullYear();
      quarter = Math.ceil((now.getMonth() + 1) / 3);
    }
  }

  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const end = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [{ data: deliveries }, { data: expenses }] = await Promise.all([
    (admin as any)
      .from("deliveries")
      .select("delivery_date, total_value, restaurants(name)")
      .gte("delivery_date", start)
      .lte("delivery_date", end),
    (admin as any)
      .from("farm_expenses")
      .select("date, amount, category")
      .gte("date", start)
      .lte("date", end),
  ]);

  // Monthly rollup
  const months = Array.from({ length: 3 }, (_, i) => {
    const m = startMonth + i;
    return `${year}-${String(m).padStart(2, "0")}`;
  });
  const monthData: Record<string, { revenue: number; expenses: number }> = {};
  for (const m of months) monthData[m] = { revenue: 0, expenses: 0 };
  for (const d of deliveries ?? []) {
    const m = d.delivery_date.slice(0, 7);
    if (monthData[m]) monthData[m].revenue += d.total_value ?? 0;
  }
  for (const e of expenses ?? []) {
    const m = e.date.slice(0, 7);
    if (monthData[m]) monthData[m].expenses += e.amount ?? 0;
  }

  const byExpenseCategory: Record<string, number> = {};
  for (const e of expenses ?? []) {
    byExpenseCategory[e.category] = (byExpenseCategory[e.category] ?? 0) + e.amount;
  }

  const byRestaurant: Record<string, number> = {};
  for (const d of deliveries ?? []) {
    const name = (d.restaurants as any)?.name ?? "Unknown";
    byRestaurant[name] = (byRestaurant[name] ?? 0) + (d.total_value ?? 0);
  }

  // P&L calculations
  const revenue = Object.values(monthData).reduce((s, m) => s + m.revenue, 0);
  const cogs = Object.values(monthData).reduce((s, m) => s + m.expenses, 0);
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
  const operatingExpenses = FARMER_PAY_PER_QUARTER;
  const operatingProfit = grossProfit - operatingExpenses;
  const operatingMargin = revenue > 0 ? operatingProfit / revenue : 0;
  const netIncome = operatingProfit; // no other income/tax adjustments
  const netMargin = revenue > 0 ? netIncome / revenue : 0;
  const acreProduction = revenue / FARM_ACRES;

  // Quarter nav
  const prevQ = quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 };
  const nextQ = quarter === 4 ? { year: year + 1, quarter: 1 } : { year, quarter: quarter + 1 };
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const isCurrentQ = year === now.getFullYear() && quarter === currentQ;

  const hasData = revenue > 0 || cogs > 0;

  return (
    <main className="pb-24 bg-farm-cream min-h-screen">
      <header className="page-header">
        <div className="flex items-center gap-2">
          <Link href="/admin/reports" className="text-gray-400 hover:text-farm-dark">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Income Statement</h1>
        </div>

        <div className="flex items-center justify-between mt-2">
          <Link
            href={`/admin/reports/income?year=${prevQ.year}&quarter=${prevQ.quarter}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-farm-dark"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-semibold text-farm-dark">Q{quarter} {year}</span>
          <Link
            href={isCurrentQ ? "#" : `/admin/reports/income?year=${nextQ.year}&quarter=${nextQ.quarter}`}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
              isCurrentQ ? "text-gray-200 pointer-events-none" : "text-gray-400 hover:text-farm-dark"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      {!hasData ? (
        <div className="px-4 py-12 text-center text-sm text-gray-400">
          No data for Q{quarter} {year}.
        </div>
      ) : (
        <div className="px-4 py-6 space-y-4">

          {/* Full P&L Statement */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-farm-dark">Press Farm · Q{quarter} {year}</p>
              <p className="text-xs text-gray-400 mt-0.5">{FARM_ACRES} acre · Income Statement</p>
            </div>

            <div className="divide-y divide-gray-50 text-sm">
              {/* Revenue */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Revenues</p>
                <div className="flex justify-between">
                  <span className="text-farm-dark">Farm Production</span>
                  <span className="font-medium text-farm-dark">{fmt(revenue)}</span>
                </div>
              </div>

              {/* COGS */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cost of Goods Sold</p>
                <div className="flex justify-between">
                  <span className="text-farm-dark">Farm Expenses</span>
                  <span className="text-red-600">{fmt(-cogs)}</span>
                </div>
                {Object.entries(byExpenseCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between mt-1 pl-3">
                    <span className="text-gray-400 text-xs">{cat}</span>
                    <span className="text-gray-400 text-xs">{fmt(-amt)}</span>
                  </div>
                ))}
              </div>

              {/* Gross Profit */}
              <div className="px-4 py-3 bg-farm-green-light/40">
                <div className="flex justify-between font-semibold">
                  <span className="text-farm-dark">Gross Profit</span>
                  <span className={grossProfit >= 0 ? "text-farm-green" : "text-red-600"}>{fmt(grossProfit)}</span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-xs text-gray-400">Gross Margin</span>
                  <span className={`text-xs font-medium ${marginColor(grossMargin, BENCHMARKS.grossMargin.min, BENCHMARKS.grossMargin.max)}`}>
                    {pct(grossProfit, revenue)} <span className="text-gray-300">·</span> <span className="text-gray-400">target {BENCHMARKS.grossMargin.range}</span>
                  </span>
                </div>
              </div>

              {/* Operating Expenses */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Operating Expenses</p>
                <div className="flex justify-between">
                  <span className="text-farm-dark">Farmer Pay</span>
                  <span className="text-red-600">{fmt(-operatingExpenses)}</span>
                </div>
              </div>

              {/* Operating Profit */}
              <div className="px-4 py-3 bg-farm-green-light/40">
                <div className="flex justify-between font-semibold">
                  <span className="text-farm-dark">Operating Profit</span>
                  <span className={operatingProfit >= 0 ? "text-farm-green" : "text-red-600"}>{fmt(operatingProfit)}</span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-xs text-gray-400">Operating Margin</span>
                  <span className={`text-xs font-medium ${marginColor(operatingMargin, BENCHMARKS.operatingMargin.min, BENCHMARKS.operatingMargin.max)}`}>
                    {pct(operatingProfit, revenue)} <span className="text-gray-300">·</span> <span className="text-gray-400">target {BENCHMARKS.operatingMargin.range}</span>
                  </span>
                </div>
              </div>

              {/* Net Income */}
              <div className="px-4 py-4 bg-farm-dark">
                <div className="flex justify-between font-bold">
                  <span className="text-white">Net Income</span>
                  <span className={netIncome >= 0 ? "text-farm-gold" : "text-red-300"}>{fmt(netIncome)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">Net Margin</span>
                  <span className={`text-xs font-medium ${netIncome >= 0 ? "text-farm-gold" : "text-red-300"}`}>
                    {pct(netIncome, revenue)} <span className="text-gray-600">·</span> <span className="text-gray-500">target {BENCHMARKS.netMargin.range}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-farm-dark">Monthly Breakdown</p>
              <div className="grid grid-cols-4 gap-1 mt-1 text-xs text-gray-400">
                <span></span>
                <span className="text-right">Revenue</span>
                <span className="text-right">Expenses</span>
                <span className="text-right">Net</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {months.map((m) => {
                const { revenue: r, expenses: e } = monthData[m];
                const net = r - e;
                const mo = m.slice(5, 7);
                return (
                  <div key={m} className="px-4 py-3 grid grid-cols-4 gap-1 text-sm items-center">
                    <span className="font-medium text-farm-dark">{MONTH_LABELS[mo]}</span>
                    <span className="text-right text-farm-green">{r > 0 ? `$${r.toFixed(0)}` : "—"}</span>
                    <span className="text-right text-red-500">{e > 0 ? `-$${e.toFixed(0)}` : "—"}</span>
                    <span className={`text-right font-medium ${net > 0 ? "text-farm-dark" : net < 0 ? "text-red-600" : "text-gray-300"}`}>
                      {r > 0 || e > 0 ? `$${net.toFixed(0)}` : "—"}
                    </span>
                  </div>
                );
              })}
              <div className="px-4 py-3 grid grid-cols-4 gap-1 text-sm font-semibold bg-gray-50">
                <span className="text-farm-dark">Total</span>
                <span className="text-right text-farm-green">${revenue.toFixed(0)}</span>
                <span className="text-right text-red-500">-${cogs.toFixed(0)}</span>
                <span className={`text-right ${(revenue - cogs) >= 0 ? "text-farm-dark" : "text-red-600"}`}>${(revenue - cogs).toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Revenue by Restaurant */}
          {Object.keys(byRestaurant).length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-farm-dark">Revenue by Restaurant</p>
              </div>
              <div className="divide-y divide-gray-50">
                {Object.entries(byRestaurant)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, value]) => (
                    <div key={name} className="px-4 py-3 flex justify-between items-center text-sm">
                      <span className="text-farm-dark">{name}</span>
                      <span className="font-medium text-farm-green">{fmt(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Industry Benchmarks */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-farm-dark">vs. Industry Benchmarks</p>
              <p className="text-xs text-gray-400 mt-0.5">National avg · Market farms</p>
            </div>
            <div className="divide-y divide-gray-50 text-sm">
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-gray-600">Gross Margin</span>
                <div className="text-right">
                  <span className={`font-medium ${marginColor(grossMargin, BENCHMARKS.grossMargin.min, BENCHMARKS.grossMargin.max)}`}>
                    {pct(grossProfit, revenue)}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">target {BENCHMARKS.grossMargin.range}</span>
                </div>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-gray-600">Operating Margin</span>
                <div className="text-right">
                  <span className={`font-medium ${marginColor(operatingMargin, BENCHMARKS.operatingMargin.min, BENCHMARKS.operatingMargin.max)}`}>
                    {pct(operatingProfit, revenue)}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">target {BENCHMARKS.operatingMargin.range}</span>
                </div>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-gray-600">Net Margin</span>
                <div className="text-right">
                  <span className={`font-medium ${marginColor(netMargin, BENCHMARKS.netMargin.min, BENCHMARKS.netMargin.max)}`}>
                    {pct(netIncome, revenue)}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">target {BENCHMARKS.netMargin.range}</span>
                </div>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-gray-600">Production / Acre</span>
                <div className="text-right">
                  <span className={`font-medium ${acreProduction >= BENCHMARKS.acreProduction.national ? "text-farm-green" : "text-amber-600"}`}>
                    {fmt(acreProduction)}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">target $100K</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </main>
  );
}
