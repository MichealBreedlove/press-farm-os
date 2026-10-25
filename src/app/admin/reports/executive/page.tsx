import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/shared/PrintButton";
import ExecutiveDashboard from "./ExecutiveDashboard";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { getProductionValue, byMonthToByYear } from "@/lib/production-value/server";
import { todayPacific } from "@/lib/utils";
import { FIELD_ACRES, GREENHOUSE_SQ_FT, SQ_FT_PER_ACRE, planterFootprint } from "@/lib/planter-beds/footprint";
import { farmerPayForRange, LEGACY_FARMER_PAY_RATES } from "@/lib/farmer-pay";


export type AnnualSummary = {
  year: string;
  /** Chef order/delivery revenue only (the clean per-chef number). */
  delivery_revenue: number;
  /** Self-harvest production value (migration 069), kept out of deliveries. */
  production_micro: number;
  production_boxes: number;
  production_total: number;
  /** Combined top-line = delivery_revenue + production_total. */
  revenue: number;
  expenses: number;
  gross_profit: number;
  farmer_pay: number;
  operating_profit: number;
  net_income: number;
  gross_margin: number;
  operating_margin: number;
  net_margin: number;
  /** Growing area for Production/Acre: the field, plus the restaurant planter
   *  boxes and the microgreen greenhouse in years they produced value. */
  acres: number;
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
  byYear: Record<string, number>;
};

export type ExecutiveData = {
  annualSummaries: AnnualSummary[];
  monthlyRevenue: MonthlyRevPoint[];
  topItemsByRevenue: TopItem[];
  topItemsByQty: TopItem[];
  restaurantByYear: RestaurantByYear[];
  expenseCategories: ExpenseCategory[];
  /** Planter-box footprint counted in `acres` (sq ft). */
  planterSqFt: number;
  /** Microgreen greenhouse footprint counted in `acres` (sq ft). */
  greenhouseSqFt: number;
  fieldAcres: number;
  /** Year the KPI strip reports on — the current year, year-to-date. */
  currentYear: string;
  /** Delivery revenue growth: this year to date vs the same span last year. */
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

  const [
    { data: deliveries },
    { data: expenses },
    { data: itemRevenueRows },
    production,
    { data: planterBoxes },
    { data: payRates },
  ] =
    await Promise.all([
      admin
        .from("deliveries")
        .select("delivery_date, total_value, restaurant_id, status, restaurants(name)")
        .order("delivery_date", { ascending: true }),

      admin
        .from("farm_expenses")
        .select("date, amount, category")
        .order("date", { ascending: true }),

      // Per-item revenue/qty, pre-aggregated in SQL (migration 065) — one row
      // per item instead of the full delivery_items history.
      admin.from("report_item_revenue").select("*"),

      // Production value (migration 069) — self-harvest, separate from deliveries.
      getProductionValue(),

      // Planter-box sizes → footprint added to the acreage (planter_boxes isn't in database.ts).
      (admin as any).from("planter_boxes").select("name, size, is_active"),

      admin
        .from("farmer_pay_rates")
        .select("effective_date, hourly_rate, hours_per_week, flat_quarterly"),
    ]);

  const planter = planterFootprint(planterBoxes ?? []);

  // Production value rolled up per year (microgreens + planter boxes).
  const prodMicroByYear = byMonthToByYear(production.microByMonth);
  const prodBoxByYear = byMonthToByYear(production.boxByMonth);

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

  const today = todayPacific();

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
    new Set([
      ...Object.keys(yearRevMap),
      ...Object.keys(yearExpMap),
      ...Object.keys(prodMicroByYear),
      ...Object.keys(prodBoxByYear),
    ])
  ).sort();

  const annualSummaries: AnnualSummary[] = allYears.map((year) => {
    const delivery_revenue = yearRevMap[year] ?? 0;
    const production_micro = prodMicroByYear[year] ?? 0;
    const production_boxes = prodBoxByYear[year] ?? 0;
    const production_total = production_micro + production_boxes;
    // Total revenue rolls production value into the top line (clearly broken
    // out below); per-chef/delivery reports keep using delivery_revenue.
    const revenue = delivery_revenue + production_total;
    const expenses = yearExpMap[year] ?? 0;
    const gross_profit = revenue - expenses;
    // Farmer pay from farmer_pay_rates (flat $12K/quarter, then hourly from
    // 2026-05-24), accrued through today so the current year isn't charged
    // for weeks not yet worked.
    const yearEnd = `${year}-12-31`;
    const payEnd = yearEnd < today ? yearEnd : today;
    const farmer_pay =
      payEnd >= `${year}-01-01`
        ? farmerPayForRange(
            payRates?.length ? payRates : LEGACY_FARMER_PAY_RATES,
            `${year}-01-01`,
            payEnd,
            quartersWithData,
          )
        : 0;
    const operating_profit = gross_profit - farmer_pay;
    const net_income = operating_profit;
    const gross_margin = revenue > 0 ? gross_profit / revenue : 0;
    const operating_margin = revenue > 0 ? operating_profit / revenue : 0;
    const net_margin = revenue > 0 ? net_income / revenue : 0;
    // Box value is counted in revenue only in years the boxes produced, so
    // their footprint joins the denominator in those same years.
    const acres =
      FIELD_ACRES +
      (production_boxes > 0 ? planter.acres : 0) +
      (production_micro > 0 ? GREENHOUSE_SQ_FT / SQ_FT_PER_ACRE : 0);
    return {
      year,
      delivery_revenue,
      production_micro,
      production_boxes,
      production_total,
      revenue,
      expenses,
      gross_profit,
      farmer_pay,
      operating_profit,
      net_income,
      gross_margin,
      operating_margin,
      net_margin,
      acres,
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

  for (const r of itemRevenueRows ?? []) {
    if (!r.item_id) continue; // GROUP BY key; never null in practice
    itemAgg[r.item_id] = {
      name: r.name ?? "",
      category: r.category ?? "",
      unit: r.unit_type ?? "",
      total_revenue: Number(r.total_revenue ?? 0),
      total_qty: Number(r.total_qty ?? 0),
    };
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

  // ---- Expense by category (with per-year breakdown) ----
  const expCatMap: Record<string, number> = {};
  const expCatYearMap: Record<string, Record<string, number>> = {};
  for (const e of expenses ?? []) {
    const cat = e.category;
    const y = (e.date ?? "").slice(0, 4);
    const amt = e.amount ?? 0;
    expCatMap[cat] = (expCatMap[cat] ?? 0) + amt;
    if (!expCatYearMap[cat]) expCatYearMap[cat] = {};
    expCatYearMap[cat][y] = (expCatYearMap[cat][y] ?? 0) + amt;
  }
  const totalExp = Object.values(expCatMap).reduce((s, v) => s + v, 0);
  const expenseCategories: ExpenseCategory[] = Object.entries(expCatMap)
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => ({
      category,
      total,
      pct: totalExp > 0 ? (total / totalExp) * 100 : 0,
      byYear: expCatYearMap[category] ?? {},
    }));

  // ---- YoY growth: this year to date vs the same span last year ----
  const currentYear = today.slice(0, 4);
  const priorYear = String(Number(currentYear) - 1);
  const monthDay = today.slice(5);
  let revYtd = 0;
  let revPriorSameSpan = 0;
  for (const d of deliveries ?? []) {
    const y = d.delivery_date.slice(0, 4);
    if (d.delivery_date.slice(5) > monthDay) continue;
    if (y === currentYear) revYtd += d.total_value ?? 0;
    else if (y === priorYear) revPriorSameSpan += d.total_value ?? 0;
  }
  const yoyGrowth =
    revPriorSameSpan > 0 ? ((revYtd - revPriorSameSpan) / revPriorSameSpan) * 100 : null;

  // ---- Top item name ----
  const topItemName = topItemsByQty[0]?.name ?? topItemsByRevenue[0]?.name ?? "—";

  const execData: ExecutiveData = {
    annualSummaries,
    monthlyRevenue,
    topItemsByRevenue,
    topItemsByQty,
    restaurantByYear,
    expenseCategories,
    planterSqFt: planter.sqFt,
    greenhouseSqFt: GREENHOUSE_SQ_FT,
    fieldAcres: FIELD_ACRES,
    currentYear,
    yoyGrowth,
    totalRevenueAllTime,
    topItemName,
  };

  return (
    <main className="pb-24 bg-farm-cream min-h-screen print:min-h-0 print:pb-0">
      <header className="page-header no-wordmark print-hide">
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
          <PrintButton label="Download PDF" />
        </div>
      </header>
      <EditorialHero
        eyebrow="By the Numbers"
        title="Executive Summary"
        subtitle="Print-ready full overview · for stakeholders"
        flower="squash-blossom"
        backHref="/admin/reports"
      />

      <ExecutiveDashboard data={execData} />
    </main>
  );
}
