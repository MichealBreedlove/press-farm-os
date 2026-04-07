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

  // Last 12 months of delivery data
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  startDate.setDate(1);
  const startStr = startDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select("delivery_date, total_value, restaurant_id, status, restaurants(name)")
    .gte("delivery_date", startStr)
    .order("delivery_date", { ascending: true });

  const { data: expenses } = await (admin as any)
    .from("farm_expenses")
    .select("date, amount, category")
    .gte("date", startStr)
    .order("date", { ascending: true });

  // Top items (all time from start)
  const { data: deliveryItems } = await (admin as any)
    .from("delivery_items")
    .select(`
      item_id, quantity, line_total,
      items ( name, category, default_unit ),
      deliveries ( delivery_date )
    `)
    .gte("deliveries.delivery_date", startStr);

  // Aggregate monthly data
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

  const monthlyData = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, net_value: m.total_value - m.total_expenses }));

  // Current month summary
  const currentData = monthMap[currentMonth] ?? {
    total_value: 0,
    total_expenses: 0,
    net_value: 0,
    by_restaurant: {},
  };

  // YTD
  const ytdYear = today.slice(0, 4);
  const ytdValue = Object.entries(monthMap)
    .filter(([m]) => m.startsWith(ytdYear))
    .reduce((sum, [, v]) => sum + v.total_value, 0);
  const ytdExpenses = Object.entries(monthMap)
    .filter(([m]) => m.startsWith(ytdYear))
    .reduce((sum, [, v]) => sum + v.total_expenses, 0);

  // Top items
  const itemAgg: Record<string, { name: string; category: string; unit: string; total_value: number; total_qty: number }> = {};
  for (const di of deliveryItems ?? []) {
    if (!di.items) continue;
    const id = di.item_id;
    if (!itemAgg[id]) {
      itemAgg[id] = {
        name: (di.items as any).name,
        category: (di.items as any).category,
        unit: (di.items as any).default_unit,
        total_value: 0,
        total_qty: 0,
      };
    }
    itemAgg[id].total_value += di.line_total ?? 0;
    itemAgg[id].total_qty += di.quantity ?? 0;
  }
  const topItems = Object.entries(itemAgg)
    .sort(([, a], [, b]) => b.total_value - a.total_value)
    .slice(0, 10)
    .map(([id, v]) => ({ item_id: id, ...v }));

  // Expense breakdown for current month
  const monthExpenseBreakdown: Record<string, number> = {};
  for (const e of expenses ?? []) {
    if (!e.date.startsWith(currentMonth)) continue;
    monthExpenseBreakdown[e.category] = (monthExpenseBreakdown[e.category] ?? 0) + e.amount;
  }

  return (
    <main className="pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-semibold">Reports</h1>
      </header>

      <ReportsDashboard
        currentMonth={currentMonth}
        currentData={{
          total_value: currentData.total_value,
          total_expenses: currentData.total_expenses,
          net_value: (currentData.total_value ?? 0) - (currentData.total_expenses ?? 0),
          by_restaurant: currentData.by_restaurant ?? {},
        }}
        ytdValue={ytdValue}
        ytdExpenses={ytdExpenses}
        monthlyData={monthlyData}
        topItems={topItems}
        expenseBreakdown={monthExpenseBreakdown}
      />
    </main>
  );
}
