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

// Q1 2026 benchmark
const BENCHMARK = { revenue: 21633, expenses: 1536, farmerPay: 12000 };

export default async function AdminIncomeStatementPage({ searchParams }: Props) {
  const { year: yearParam, quarter: quarterParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const year = parseInt(yearParam ?? String(now.getFullYear()));
  const quarter = parseInt(quarterParam ?? String(Math.ceil((now.getMonth() + 1) / 3)));

  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const end = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const admin = createAdminClient();
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

  // Build monthly data
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

  const totalRevenue = Object.values(monthData).reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = Object.values(monthData).reduce((s, m) => s + m.expenses, 0);
  const netMargin = totalRevenue - totalExpenses;

  // Quarter nav
  const prevQ = quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 };
  const nextQ = quarter === 4 ? { year: year + 1, quarter: 1 } : { year, quarter: quarter + 1 };
  const isCurrentQ = year === now.getFullYear() && quarter === Math.ceil((now.getMonth() + 1) / 3);

  const isBenchmark = year === 2026 && quarter === 1;

  return (
    <main className="pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-900">Income Statement</h1>

        {/* Quarter nav */}
        <div className="flex items-center justify-between mt-2">
          <Link
            href={`/admin/reports/income?year=${prevQ.year}&quarter=${prevQ.quarter}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-gray-900">Q{quarter} {year}</span>
          <Link
            href={isCurrentQ ? "#" : `/admin/reports/income?year=${nextQ.year}&quarter=${nextQ.quarter}`}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
              isCurrentQ ? "text-gray-200" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="px-4 py-6 space-y-5">
        {/* Benchmark note */}
        {isBenchmark && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
            Benchmark: ${BENCHMARK.revenue.toLocaleString()} revenue · ${BENCHMARK.expenses.toLocaleString()} expenses · ${BENCHMARK.farmerPay.toLocaleString()} farmer pay
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs text-green-700 font-medium">Production Value</p>
            <p className="text-xl font-bold text-green-900 mt-1">${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            {isBenchmark && <p className="text-xs text-green-600 mt-0.5">Benchmark ${BENCHMARK.revenue.toLocaleString()}</p>}
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-xs text-orange-700 font-medium">Expenses</p>
            <p className="text-xl font-bold text-orange-900 mt-1">${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            {isBenchmark && <p className="text-xs text-orange-600 mt-0.5">Benchmark ${BENCHMARK.expenses.toLocaleString()}</p>}
          </div>
          <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-blue-700 font-medium">Net Margin</p>
              <p className="text-xl font-bold text-blue-900 mt-1">${netMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            {totalRevenue > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-800">
                  {((netMargin / totalRevenue) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-blue-500">margin</p>
              </div>
            )}
          </div>
        </div>

        {/* Monthly breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-900">Monthly Breakdown</p>
          </div>
          <div className="divide-y divide-gray-50">
            {months.map((m) => {
              const { revenue, expenses } = monthData[m];
              const net = revenue - expenses;
              const mo = m.slice(5, 7);
              return (
                <div key={m} className="px-4 py-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-700 w-10">{MONTH_LABELS[mo]}</span>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-right text-sm">
                    <span className="text-green-700">${revenue.toFixed(0)}</span>
                    <span className="text-orange-600">-${expenses.toFixed(0)}</span>
                    <span className={net >= 0 ? "text-blue-700 font-medium" : "text-red-600 font-medium"}>
                      ${net.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="px-4 py-3 flex items-center justify-between gap-2 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700 w-10">Total</span>
              <div className="flex-1 grid grid-cols-3 gap-2 text-right text-sm font-semibold">
                <span className="text-green-700">${totalRevenue.toFixed(0)}</span>
                <span className="text-orange-600">-${totalExpenses.toFixed(0)}</span>
                <span className={netMargin >= 0 ? "text-blue-700" : "text-red-600"}>${netMargin.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by restaurant */}
        {Object.keys(byRestaurant).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">Revenue by Restaurant</p>
            </div>
            <div className="divide-y divide-gray-50">
              {Object.entries(byRestaurant)
                .sort(([, a], [, b]) => b - a)
                .map(([name, value]) => (
                  <div key={name} className="px-4 py-3 flex justify-between items-center text-sm">
                    <span className="text-gray-700">{name}</span>
                    <span className="font-medium text-gray-900">${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Expense breakdown */}
        {Object.keys(byExpenseCategory).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">Expense Breakdown</p>
            </div>
            <div className="divide-y divide-gray-50">
              {Object.entries(byExpenseCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amount]) => (
                  <div key={cat} className="px-4 py-3 flex justify-between items-center text-sm">
                    <span className="text-gray-700">{cat}</span>
                    <span className="font-medium text-orange-700">${amount.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {totalRevenue === 0 && totalExpenses === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">No data for Q{quarter} {year}.</p>
        )}
      </div>
    </main>
  );
}
