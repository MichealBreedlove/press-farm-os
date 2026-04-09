import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const ReportsDashboard = dynamic(() => import("./ReportsDashboard"), { ssr: false });

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  // Fetch ALL historical delivery and expense data
  const [{ data: deliveries }, { data: expenses }, { data: deliveryItems }] = await Promise.all([
    (admin as any)
      .from("deliveries")
      .select("delivery_date, total_value, restaurant_id, status, restaurants(name)")
      .order("delivery_date", { ascending: true }),

    (admin as any)
      .from("farm_expenses")
      .select("date, amount, category")
      .order("date", { ascending: true }),

    (admin as any)
      .from("delivery_items")
      .select(`
        item_id, quantity, line_total,
        items ( name, category, default_unit ),
        deliveries ( delivery_date )
      `),
  ]);

  // Aggregate monthly data (all time)
  const monthMap: Record<string, {
    month: string;
    label: string;
    total_value: number;
    total_expenses: number;
    by_restaurant: Record<string, number>;
  }> = {};

  for (const d of deliveries ?? []) {
    const m = d.delivery_date.slice(0, 7);
    if (!monthMap[m]) {
      const [y, mo] = m.split("-").map(Number);
      const label = new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthMap[m] = { month: m, label, total_value: 0, total_expenses: 0, by_restaurant: {} };
    }
    monthMap[m].total_value += d.total_value ?? 0;
    const rName = (d.restaurants as any)?.name ?? "Unknown";
    monthMap[m].by_restaurant[rName] = (monthMap[m].by_restaurant[rName] ?? 0) + (d.total_value ?? 0);
  }

  for (const e of expenses ?? []) {
    const m = e.date.slice(0, 7);
    if (!monthMap[m]) {
      const [y, mo] = m.split("-").map(Number);
      const label = new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthMap[m] = { month: m, label, total_value: 0, total_expenses: 0, by_restaurant: {} };
    }
    monthMap[m].total_expenses += e.amount ?? 0;
  }

  const allMonthlyData = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, net_value: m.total_value - m.total_expenses }));

  // Year-over-year annual summaries
  const yearMap: Record<string, { revenue: number; expenses: number }> = {};
  for (const m of allMonthlyData) {
    const y = m.month.slice(0, 4);
    if (!yearMap[y]) yearMap[y] = { revenue: 0, expenses: 0 };
    yearMap[y].revenue += m.total_value;
    yearMap[y].expenses += m.total_expenses;
  }
  const annualData = Object.entries(yearMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, v]) => ({ year, ...v, net: v.revenue - v.expenses }));

  // Current month — fall back to most recent month with data
  const latestMonth = Object.keys(monthMap).sort().at(-1) ?? currentMonth;
  const displayMonth = monthMap[currentMonth] ? currentMonth : latestMonth;
  const currentData = monthMap[displayMonth] ?? { total_value: 0, total_expenses: 0, net_value: 0, by_restaurant: {} };

  // YTD for the display year
  const ytdYear = displayMonth.slice(0, 4);
  const ytdValue = allMonthlyData.filter(m => m.month.startsWith(ytdYear)).reduce((s, m) => s + m.total_value, 0);
  const ytdExpenses = allMonthlyData.filter(m => m.month.startsWith(ytdYear)).reduce((s, m) => s + m.total_expenses, 0);

  // Top items (all time — from delivery_items detail records only, not aggregates)
  const itemAgg: Record<string, { name: string; category: string; unit: string; total_value: number; total_qty: number }> = {};
  for (const di of deliveryItems ?? []) {
    if (!di.items) continue;
    itemAgg[di.item_id] ??= {
      name: (di.items as any).name,
      category: (di.items as any).category,
      unit: (di.items as any).default_unit,
      total_value: 0,
      total_qty: 0,
    };
    itemAgg[di.item_id].total_value += di.line_total ?? 0;
    itemAgg[di.item_id].total_qty += di.quantity ?? 0;
  }
  const topItems = Object.entries(itemAgg)
    .sort(([, a], [, b]) => b.total_value - a.total_value)
    .slice(0, 15)
    .map(([id, v]) => ({ item_id: id, ...v }));

  // Expense breakdown for display month
  const monthExpenseBreakdown: Record<string, number> = {};
  for (const e of expenses ?? []) {
    if (!e.date.startsWith(displayMonth)) continue;
    monthExpenseBreakdown[e.category] = (monthExpenseBreakdown[e.category] ?? 0) + e.amount;
  }

  // Revenue forecast: 3-month trailing average projected forward 3 months
  const sortedMonths = allMonthlyData.filter(m => m.total_value > 0);
  const last3 = sortedMonths.slice(-3);
  const avgMonthlyRevenue = last3.length > 0 ? last3.reduce((s, m) => s + m.total_value, 0) / last3.length : 0;
  const avgMonthlyExpenses = last3.length > 0 ? last3.reduce((s, m) => s + m.total_expenses, 0) / last3.length : 0;

  // Generate next 3 months
  const forecastMonths: { month: string; label: string; revenue: number; expenses: number }[] = [];
  if (last3.length > 0) {
    const lastM = sortedMonths[sortedMonths.length - 1].month;
    const [ly, lm] = lastM.split("-").map(Number);
    for (let i = 1; i <= 3; i++) {
      const fm = lm + i > 12 ? lm + i - 12 : lm + i;
      const fy = lm + i > 12 ? ly + 1 : ly;
      const mStr = `${fy}-${String(fm).padStart(2, "0")}`;
      const label = new Date(fy, fm - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      forecastMonths.push({ month: mStr, label, revenue: avgMonthlyRevenue, expenses: avgMonthlyExpenses });
    }
  }

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Reports</h1>
      </header>

      {/* Executive Summary CTA */}
      <div className="px-4 pt-4">
        <a
          href="/admin/reports/executive"
          className="card-interactive flex items-center justify-between px-4 py-4 mb-0"
        >
          <div>
            <p className="text-sm font-semibold text-farm-dark">Executive Summary</p>
            <p className="text-xs text-gray-400 mt-0.5">Full P&amp;L · YoY growth · Top items · Benchmarks</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <ReportsDashboard
        currentMonth={displayMonth}
        currentData={{
          total_value: currentData.total_value,
          total_expenses: currentData.total_expenses,
          net_value: currentData.total_value - currentData.total_expenses,
          by_restaurant: currentData.by_restaurant ?? {},
        }}
        ytdValue={ytdValue}
        ytdExpenses={ytdExpenses}
        monthlyData={allMonthlyData}
        annualData={annualData}
        topItems={topItems}
        expenseBreakdown={monthExpenseBreakdown}
        forecast={forecastMonths}
      />
    </main>
  );
}
