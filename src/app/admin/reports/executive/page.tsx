import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/shared/PrintButton";
import ExecutiveDashboard from "./ExecutiveDashboard";

const FARMER_PAY_PER_QUARTER = 12000;
const FARM_ACRES = 0.5;

// Calculate farmer pay for a given year based on quarters that have delivery data
function calcFarmerPay(year: string, quartersWithData: Set<string>): number {
  let count = 0;
  for (let q = 1; q <= 4; q++) {
    if (quartersWithData.has(`${year}-Q${q}`)) count++;
  }
  return count * FARMER_PAY_PER_QUARTER;
}

export type AnnualSummary = {
  year: string;
  revenue: number;
  expenses: number;
  gross_profit: number;
  farmer_pay: number;
  operating_profit: number;
  net_income: number;
  gross_margin: number;
  operating_margin: number;
  net_margin: number;
};

export type MonthlyRevPoint = {
  month: string;
  label: string;
  year: string;
  revenue: number;
};

export type TopItem = {
  item_id: string;
  name: string;
  category: string;
  unit: string;
  total_revenue: number;
  total_qty: number;
  avg_price: number;
  revenue_pct: number;
};

export type RestaurantByYear = {
  year: string;
  by_restaurant: Record<string, number>;
};

export type ExpenseCategory = {
  category: string;
  total: number;
  pct: number;
};

export type ExecutiveData = {
  annualSummaries: AnnualSummary[];
  monthlyRevenue: MonthlyRevPoint[];
  topItemsByRevenue: TopItem[];
  topItemsByQty: TopItem[];
  restaurantByYear: RestaurantByYear[];
  expenseCategories: ExpenseCategory[];
  yoyGrowth: number | null;
  totalRevenueAllTime: number;
  topItemName: string;
};

export default async function AdminExecutiveReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: deliveries }, { data: expenses }, { data: deliveryItems }] =
    await Promise.all([
      (admin as any)
        .from("deliveries")
        .select("delivery_date, total_value, restaurant_id, status, restaurants(name)")
        .order("delivery_date", { ascending: true }),

      (admin as any)
        .from("farm_expenses")
        .select("date, amount, category")
        .order("date", { ascending: true }),

      (admin as any).from("delivery_items").select(`
          item_id, quantity, line_total,
          items ( name, category, unit_type ),
          deliveries ( delivery_date )
        `),
    ]);

  // ---- Monthly revenue map ----
  const monthRevMap: Record<
    string,
    { revenue: number; by_restaurant: Record<string, number> }
  > = {};

  const quartersWithData = new Set<string>();

  for (const d of deliveries ?? []) {
    const m = d.delivery_date.slice(0, 7);
    const year = m.slice(0, 4);
    const month = parseInt(m.slice(5, 7));
    const q = Math.ceil(month / 3);
    quartersWithData.add(`${year}-Q${q}`);

    if (!monthRevMap[m]) monthRevMap[m] = { revenue: 0, by_restaurant: {} };
    monthRevMap[m].revenue += d.total_value ?? 0;
    const rName = (d.restaurants as any)?.name ?? "Unknown";
    monthRevMap[m].by_restaurant[rName] =
      (monthRevMap[m].by_restaurant[rName] ?? 0) + (d.total_value ?? 0);
  }

  // ---- Monthly expense map ----
  const monthExpMap: Record<string, number> = {};
  for (const e of expenses ?? []) {
    const m = e.date.slice(0, 7);
    monthExpMap[m] = (monthExpMap[m] ?? 0) + (e.amount ?? 0);
  }

  // ---- Annual summaries ----
  const yearRevMap: Record<string, number> = {};
  const yearExpMap: Record<string, number> = {};
  const yearRestMap: Record<string, Record<string, number>> = {};

  for (const [m, v] of Object.entries(monthRevMap)) {
    const y = m.slice(0, 4);
    yearRevMap[y] = (yearRevMap[y] ?? 0) + v.revenue;
    if (!yearRestMap[y]) yearRestMap[y] = {};
    for (const [rn, rv] of Object.entries(v.by_restaurant)) {
      yearRestMap[y][rn] = (yearRestMap[y][rn] ?? 0) + rv;
    }
  }
  for (const [m, amt] of Object.entries(monthExpMap)) {
    const y = m.slice(0, 4);
    yearExpMap[y] = (yearExpMap[y] ?? 0) + amt;
  }

  const allYears = Array.from(
    new Set([...Object.keys(yearRevMap), ...Object.keys(yearExpMap)])
  ).sort();

  const annualSummaries: AnnualSummary[] = allYears.map((year) => {
    const revenue = yearRevMap[year] ?? 0;
    const expenses = yearExpMap[year] ?? 0;
    const gross_profit = revenue - expenses;
    const farmer_pay = calcFarmerPay(year, quartersWithData);
    const operating_profit = gross_profit - farmer_pay;
    const net_income = operating_profit;
    const gross_margin = revenue > 0 ? gross_profit / revenue : 0;
    const operating_margin = revenue > 0 ? operating_profit / revenue : 0;
    const net_margin = revenue > 0 ? net_income / revenue : 0;
    return {
      year,
      revenue,
      expenses,
      gross_profit,
      farmer_pay,
      operating_profit,
      net_income,
      gross_margin,
      operating_margin,
      net_margin,
    };
  });

  // ---- Monthly revenue for chart (last 2 full years + current partial) ----
  const MONTH_SHORT: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
  };

  const monthlyRevenue: MonthlyRevPoint[] = Object.entries(monthRevMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => {
      const year = m.slice(0, 4);
      const mo = m.slice(5, 7);
      return {
        month: m,
        label: MONTH_SHORT[mo] ?? mo,
        year,
        revenue: v.revenue,
      };
    });

  // ---- Revenue by restaurant per year ----
  const restaurantByYear: RestaurantByYear[] = allYears.map((year) => ({
    year,
    by_restaurant: yearRestMap[year] ?? {},
  }));

  // ---- Item aggregation ----
  const itemAgg: Record<
    string,
    {
      name: string;
      category: string;
      unit: string;
      total_revenue: number;
      total_qty: number;
    }
  > = {};

  for (const di of deliveryItems ?? []) {
    if (!di.items) continue;
    const id = di.item_id;
    if (!itemAgg[id]) {
      itemAgg[id] = {
        name: (di.items as any).name,
        category: (di.items as any).category,
        unit: (di.items as any).unit_type,
        total_revenue: 0,
        total_qty: 0,
      };
    }
    itemAgg[id].total_revenue += di.line_total ?? 0;
    itemAgg[id].total_qty += di.quantity ?? 0;
  }

  const totalRevenueAllTime = Object.values(itemAgg).reduce(
    (s, v) => s + v.total_revenue,
    0
  );

  const makeTopItems = (sorted: [string, typeof itemAgg[string]][]): TopItem[] =>
    sorted.slice(0, 20).map(([id, v]) => ({
      item_id: id,
      name: v.name,
      category: v.category,
      unit: v.unit,
      total_revenue: v.total_revenue,
      total_qty: v.total_qty,
      avg_price: v.total_qty > 0 ? v.total_revenue / v.total_qty : 0,
      revenue_pct:
        totalRevenueAllTime > 0
          ? (v.total_revenue / totalRevenueAllTime) * 100
          : 0,
    }));

  const topItemsByRevenue = makeTopItems(
    Object.entries(itemAgg).sort(([, a], [, b]) => b.total_revenue - a.total_revenue)
  );

  const topItemsByQty = makeTopItems(
    Object.entries(itemAgg)
      .sort(([, a], [, b]) => b.total_qty - a.total_qty)
      .slice(0, 15)
  );

  // ---- Expense by category ----
  const expCatMap: Record<string, number> = {};
  for (const e of expenses ?? []) {
    expCatMap[e.category] = (expCatMap[e.category] ?? 0) + (e.amount ?? 0);
  }
  const totalExp = Object.values(expCatMap).reduce((s, v) => s + v, 0);
  const expenseCategories: ExpenseCategory[] = Object.entries(expCatMap)
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => ({
      category,
      total,
      pct: totalExp > 0 ? (total / totalExp) * 100 : 0,
    }));

  // ---- YoY growth 2024→2025 ----
  const rev2024 = yearRevMap["2024"] ?? 0;
  const rev2025 = yearRevMap["2025"] ?? 0;
  const yoyGrowth =
    rev2024 > 0 ? ((rev2025 - rev2024) / rev2024) * 100 : null;

  // ---- Top item name ----
  const topItemName = topItemsByQty[0]?.name ?? topItemsByRevenue[0]?.name ?? "—";

  const execData: ExecutiveData = {
    annualSummaries,
    monthlyRevenue,
    topItemsByRevenue,
    topItemsByQty,
    restaurantByYear,
    expenseCategories,
    yoyGrowth,
    totalRevenueAllTime,
    topItemName,
  };

  return (
    <main className="pb-24 bg-farm-cream min-h-screen print:min-h-0 print:pb-0">
      <header className="page-header print-hide">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/admin/reports" className="text-white/70 hover:text-white">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </a>
            <h1 className="page-title">Executive Summary</h1>
          </div>
          <PrintButton />
        </div>
      </header>

      <ExecutiveDashboard data={execData} />
    </main>
  );
}
