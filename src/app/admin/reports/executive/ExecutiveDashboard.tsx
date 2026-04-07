"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { ExecutiveData } from "./page";

// ---- Formatting helpers ----
function fmt(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return sign + "$" + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return sign + "$" + (abs / 1_000).toFixed(0) + "K";
  return sign + "$" + abs.toFixed(0);
}

function fmtPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

function marginColor(val: number, min: number, max: number) {
  if (val >= min) return "text-farm-green";
  if (val >= min * 0.7) return "text-amber-600";
  return "text-red-600";
}

const BENCHMARKS = {
  grossMargin: { min: 0.5, max: 0.7, range: "50–70%" },
  operatingMargin: { min: 0.3, max: 0.5, range: "30–50%" },
  netMargin: { min: 0.2, max: 0.4, range: "20–40%" },
  acreProduction: { national: 100_000 },
};

const FARM_ACRES = 0.5;

const YEAR_COLORS: Record<string, string> = {
  "2024": "#9ca3af",
  "2025": "#00774A",
  "2026": "#F0B530",
};

function yearColor(y: string) {
  return YEAR_COLORS[y] ?? "#6b7280";
}

const CATEGORY_COLORS = [
  "#00774A", "#4ade80", "#F0B530", "#F37441",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

// ---- Sub-components ----

function KpiBanner({ data }: { data: ExecutiveData }) {
  const fy2025 = data.annualSummaries.find((a) => a.year === "2025");
  const rev2025 = fy2025?.revenue ?? 0;
  const net2025 = fy2025?.net_income ?? 0;
  const netMargin2025 = fy2025?.net_margin ?? 0;
  const productionPerAcre = rev2025 / FARM_ACRES;

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">
        FY2025 Highlights
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* Revenue */}
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">FY2025 Revenue</p>
          <p className="text-xl font-bold text-farm-dark">{fmtShort(rev2025)}</p>
          {data.yoyGrowth !== null && (
            <p className={`text-xs font-medium mt-1 ${data.yoyGrowth >= 0 ? "text-farm-green" : "text-red-500"}`}>
              {data.yoyGrowth >= 0 ? "+" : ""}{data.yoyGrowth.toFixed(0)}% vs 2024
            </p>
          )}
        </div>

        {/* Net Income */}
        <div className="bg-farm-dark text-white rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">FY2025 Net Income</p>
          <p className="text-xl font-bold text-farm-gold">{fmtShort(net2025)}</p>
          <p className="text-xs text-gray-400 mt-1">Net margin {fmtPct(netMargin2025)}</p>
        </div>

        {/* Production/Acre */}
        <div className="bg-farm-green text-white rounded-xl p-4">
          <p className="text-xs text-green-200 mb-1">Production / Acre</p>
          <p className="text-xl font-bold">{fmtShort(productionPerAcre)}</p>
          <p className="text-xs text-green-300 mt-1">
            {productionPerAcre >= 100_000 ? "Above" : "Below"} $100K benchmark
          </p>
        </div>

        {/* Top Item */}
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Most Ordered Item</p>
          <p className="text-sm font-bold text-farm-dark leading-tight">{data.topItemName}</p>
          <p className="text-xs text-gray-400 mt-1">by quantity</p>
        </div>
      </div>
    </div>
  );
}

function AnnualPL({ annualSummaries }: { annualSummaries: ExecutiveData["annualSummaries"] }) {
  const years = annualSummaries.map((a) => a.year);
  const byYear: Record<string, (typeof annualSummaries)[0]> = {};
  for (const a of annualSummaries) byYear[a.year] = a;

  type Row = { label: string; key: keyof typeof annualSummaries[0]; isMoney: boolean; isPct: boolean; isSubtotal?: boolean; isDark?: boolean };
  const rows: Row[] = [
    { label: "Revenue", key: "revenue", isMoney: true, isPct: false, isSubtotal: true },
    { label: "Farm Expenses (COGS)", key: "expenses", isMoney: true, isPct: false },
    { label: "Gross Profit", key: "gross_profit", isMoney: true, isPct: false, isSubtotal: true },
    { label: "Gross Margin %", key: "gross_margin", isMoney: false, isPct: true },
    { label: "Farmer Pay", key: "farmer_pay", isMoney: true, isPct: false },
    { label: "Operating Profit", key: "operating_profit", isMoney: true, isPct: false, isSubtotal: true },
    { label: "Operating Margin %", key: "operating_margin", isMoney: false, isPct: true },
    { label: "Net Income", key: "net_income", isMoney: true, isPct: false, isDark: true },
    { label: "Net Margin %", key: "net_margin", isMoney: false, isPct: true, isDark: true },
  ];

  const colYears = ["2024", "2025", "2026"];

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-farm-dark">Annual P&amp;L Comparison</p>
        <p className="text-xs text-gray-400 mt-0.5">All figures in USD</p>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-4 gap-1 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
        <span></span>
        {colYears.map((y) => (
          <span key={y} className="text-right" style={{ color: yearColor(y) }}>
            FY{y}{y === "2026" ? " YTD" : ""}
          </span>
        ))}
      </div>

      <div className="divide-y divide-gray-50">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`grid grid-cols-4 gap-1 px-4 py-2.5 text-sm items-center
              ${row.isDark ? "bg-farm-dark text-white" : row.isSubtotal ? "bg-farm-green-light/30" : ""}`}
          >
            <span className={`text-xs font-medium ${row.isDark ? "text-gray-300" : "text-gray-600"}`}>
              {row.label}
            </span>
            {colYears.map((y) => {
              const summary = byYear[y];
              if (!summary) {
                return (
                  <span key={y} className={`text-right text-xs ${row.isDark ? "text-gray-500" : "text-gray-300"}`}>
                    —
                  </span>
                );
              }
              const val = summary[row.key] as number;
              if (row.isPct) {
                const pctVal = (val * 100).toFixed(1) + "%";
                const isBad = val < 0;
                const colorClass = row.isDark
                  ? isBad ? "text-red-400" : "text-farm-gold"
                  : isBad ? "text-red-500" : "text-gray-700";
                return (
                  <span key={y} className={`text-right text-xs font-medium ${colorClass}`}>
                    {pctVal}
                  </span>
                );
              }
              // Money
              const isExpense = row.key === "expenses" || row.key === "farmer_pay";
              const display = isExpense ? fmt(-val) : fmt(val);
              const isNeg = val < 0;
              const colorClass = row.isDark
                ? isNeg ? "text-red-400" : "text-farm-gold"
                : isNeg || isExpense
                ? "text-red-600"
                : row.isSubtotal
                ? "text-farm-green font-semibold"
                : "text-farm-dark";
              return (
                <span key={y} className={`text-right text-xs font-medium ${colorClass}`}>
                  {display}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueByYearChart({ monthlyRevenue }: { monthlyRevenue: ExecutiveData["monthlyRevenue"] }) {
  // Build a month label list and pivot by year
  const years = Array.from(new Set(monthlyRevenue.map((p) => p.year))).sort();

  // Build 12-slot arrays for each year
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  type ChartPoint = { month: string } & Record<string, number>;
  const chartData: ChartPoint[] = MONTHS.map((m) => ({ month: m }));

  for (const pt of monthlyRevenue) {
    const moIdx = parseInt(pt.month.slice(5, 7)) - 1;
    const row = chartData[moIdx];
    row[pt.year] = (row[pt.year] ?? 0) + pt.revenue;
  }

  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-gray-700 mb-1">Revenue by Year — Monthly</p>
      <div className="flex gap-3 mb-3">
        {years.map((y) => (
          <div key={y} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: yearColor(y) }} />
            <span className="text-xs text-gray-500">{y}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(v: number, name: string) => [fmt(v), name]}
            labelStyle={{ fontSize: 12 }}
          />
          {years.map((y) => (
            <Bar key={y} dataKey={y} fill={yearColor(y)} name={y} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RestaurantTable({ restaurantByYear }: { restaurantByYear: ExecutiveData["restaurantByYear"] }) {
  const allRestaurants = Array.from(
    new Set(restaurantByYear.flatMap((r) => Object.keys(r.by_restaurant)))
  );

  const years = restaurantByYear.map((r) => r.year).sort();
  const byYear: Record<string, Record<string, number>> = {};
  for (const r of restaurantByYear) byYear[r.year] = r.by_restaurant;

  const totalCols = 1 + years.length;
  const gridCols = `grid-cols-${totalCols + 1}`;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-farm-dark">Revenue by Restaurant</p>
      </div>
      <div className={`grid px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 gap-2`}
        style={{ gridTemplateColumns: `1fr ${years.map(() => "1fr").join(" ")}` }}
      >
        <span>Restaurant</span>
        {years.map((y) => (
          <span key={y} className="text-right" style={{ color: yearColor(y) }}>
            {y}
          </span>
        ))}
      </div>
      <div className="divide-y divide-gray-50">
        {allRestaurants.map((name) => (
          <div
            key={name}
            className="px-4 py-3 text-sm items-center gap-2"
            style={{ display: "grid", gridTemplateColumns: `1fr ${years.map(() => "1fr").join(" ")}` }}
          >
            <span className="text-farm-dark font-medium">{name}</span>
            {years.map((y) => {
              const val = byYear[y]?.[name] ?? 0;
              return (
                <span key={y} className={`text-right text-xs font-medium ${val > 0 ? "text-farm-green" : "text-gray-300"}`}>
                  {val > 0 ? fmtShort(val) : "—"}
                </span>
              );
            })}
          </div>
        ))}
        {/* Totals */}
        <div
          className="px-4 py-3 text-sm font-semibold bg-gray-50 gap-2"
          style={{ display: "grid", gridTemplateColumns: `1fr ${years.map(() => "1fr").join(" ")}` }}
        >
          <span className="text-farm-dark">Total</span>
          {years.map((y) => {
            const total = allRestaurants.reduce((s, n) => s + (byYear[y]?.[n] ?? 0), 0);
            return (
              <span key={y} className="text-right text-farm-green text-xs">
                {fmtShort(total)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TopItemsTable({
  items,
  title,
  sortBy,
}: {
  items: ExecutiveData["topItemsByRevenue"];
  title: string;
  sortBy: "revenue" | "qty";
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-farm-dark">{title}</p>
      </div>
      {/* Header */}
      <div className="grid px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-400 border-b border-gray-100"
        style={{ gridTemplateColumns: "24px 1fr 60px 60px 56px 48px" }}
      >
        <span>#</span>
        <span>Item</span>
        <span className="text-right">Revenue</span>
        <span className="text-right">Qty</span>
        <span className="text-right">$/Unit</span>
        <span className="text-right">%Rev</span>
      </div>
      {items.map((item, i) => (
        <div
          key={item.item_id}
          className="grid px-4 py-2.5 text-xs border-b border-gray-50 last:border-0 items-center"
          style={{ gridTemplateColumns: "24px 1fr 60px 60px 56px 48px" }}
        >
          <span className="text-gray-300 font-medium">{i + 1}</span>
          <div className="min-w-0 pr-1">
            <p className="text-farm-dark font-medium truncate">{item.name}</p>
            <p className="text-gray-400 text-xs">{item.category}</p>
          </div>
          <span className={`text-right font-medium ${sortBy === "revenue" ? "text-farm-green" : "text-gray-700"}`}>
            {fmtShort(item.total_revenue)}
          </span>
          <span className={`text-right font-medium ${sortBy === "qty" ? "text-farm-green" : "text-gray-700"}`}>
            {item.total_qty.toFixed(0)} <span className="text-gray-400">{item.unit}</span>
          </span>
          <span className="text-right text-gray-600">{fmtShort(item.avg_price)}</span>
          <span className="text-right text-gray-400">{item.revenue_pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function ExpenseBreakdown({ expenseCategories }: { expenseCategories: ExecutiveData["expenseCategories"] }) {
  const total = expenseCategories.reduce((s, e) => s + e.total, 0);
  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Expenses by Category (All Time)
        </p>
        <ResponsiveContainer width="100%" height={Math.max(150, expenseCategories.length * 30)}>
          <BarChart
            data={expenseCategories}
            layout="vertical"
            margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="category" tick={{ fontSize: 9 }} width={80} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="total" name="Amount" radius={[0, 3, 3, 0]}>
              {expenseCategories.map((_, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-farm-dark">Expense Categories</p>
            <p className="text-sm font-bold text-red-600">{fmt(total)} total</p>
          </div>
        </div>
        {expenseCategories.map((e) => (
          <div key={e.category} className="px-4 py-3 flex items-center border-b border-gray-50 last:border-0">
            <p className="text-sm text-farm-dark flex-1">{e.category}</p>
            <p className="text-xs text-gray-400 mr-4">{e.pct.toFixed(1)}%</p>
            <p className="text-sm font-medium text-red-600 text-right w-20">{fmt(e.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BenchmarksAllYears({ annualSummaries }: { annualSummaries: ExecutiveData["annualSummaries"] }) {
  const years = annualSummaries.map((a) => a.year);
  const byYear: Record<string, (typeof annualSummaries)[0]> = {};
  for (const a of annualSummaries) byYear[a.year] = a;

  type BRow = { label: string; target: string; min: number; getValue: (s: (typeof annualSummaries)[0]) => number; isPct: boolean };
  const brows: BRow[] = [
    { label: "Gross Margin", target: "50–70%", min: 0.5, getValue: (s) => s.gross_margin, isPct: true },
    { label: "Operating Margin", target: "30–50%", min: 0.3, getValue: (s) => s.operating_margin, isPct: true },
    { label: "Net Margin", target: "20–40%", min: 0.2, getValue: (s) => s.net_margin, isPct: true },
    {
      label: "Production/Acre",
      target: "$100K",
      min: 100_000,
      getValue: (s) => s.revenue / FARM_ACRES,
      isPct: false,
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-farm-dark">Benchmarks vs Industry</p>
        <p className="text-xs text-gray-400 mt-0.5">National avg · Market farms · 0.5 acre</p>
      </div>
      {/* header */}
      <div
        className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400"
        style={{ display: "grid", gridTemplateColumns: `1fr 60px ${years.map(() => "1fr").join(" ")}` }}
      >
        <span>Metric</span>
        <span className="text-center">Target</span>
        {years.map((y) => (
          <span key={y} className="text-right" style={{ color: yearColor(y) }}>{y}</span>
        ))}
      </div>
      <div className="divide-y divide-gray-50">
        {brows.map((row) => (
          <div
            key={row.label}
            className="px-4 py-3 text-sm items-center"
            style={{ display: "grid", gridTemplateColumns: `1fr 60px ${years.map(() => "1fr").join(" ")}` }}
          >
            <span className="text-gray-600 text-xs">{row.label}</span>
            <span className="text-center text-xs text-gray-400">{row.target}</span>
            {years.map((y) => {
              const summary = byYear[y];
              if (!summary) return <span key={y} className="text-right text-gray-300 text-xs">—</span>;
              const val = row.getValue(summary);
              const colorClass = row.isPct
                ? marginColor(val, row.min, row.min * 1.4)
                : val >= row.min
                ? "text-farm-green"
                : "text-amber-600";
              return (
                <span key={y} className={`text-right text-xs font-medium ${colorClass}`}>
                  {row.isPct ? (val * 100).toFixed(1) + "%" : fmtShort(val)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main export ----
export default function ExecutiveDashboard({ data }: { data: ExecutiveData }) {
  return (
    <div className="px-4 py-4 space-y-6">

      {/* A. KPI Banner */}
      <KpiBanner data={data} />

      {/* B. Annual P&L Comparison */}
      <AnnualPL annualSummaries={data.annualSummaries} />

      {/* C. Revenue by Year Chart */}
      {data.monthlyRevenue.length > 0 && (
        <RevenueByYearChart monthlyRevenue={data.monthlyRevenue} />
      )}

      {/* D. Revenue by Restaurant */}
      {data.restaurantByYear.length > 0 && (
        <RestaurantTable restaurantByYear={data.restaurantByYear} />
      )}

      {/* E. Top 20 Items by Revenue */}
      {data.topItemsByRevenue.length > 0 && (
        <TopItemsTable
          items={data.topItemsByRevenue}
          title="Top 20 Items by Revenue (All Time)"
          sortBy="revenue"
        />
      )}

      {/* F. Top 15 Items by Quantity */}
      {data.topItemsByQty.length > 0 && (
        <TopItemsTable
          items={data.topItemsByQty}
          title="Top 15 Items by Quantity Ordered"
          sortBy="qty"
        />
      )}

      {/* G. Expense Breakdown */}
      {data.expenseCategories.length > 0 && (
        <ExpenseBreakdown expenseCategories={data.expenseCategories} />
      )}

      {/* H. Benchmarks All Years */}
      {data.annualSummaries.length > 0 && (
        <BenchmarksAllYears annualSummaries={data.annualSummaries} />
      )}

      {data.annualSummaries.length === 0 && data.monthlyRevenue.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-12">
          No delivery data yet — log deliveries to see the executive summary.
        </p>
      )}
    </div>
  );
}
