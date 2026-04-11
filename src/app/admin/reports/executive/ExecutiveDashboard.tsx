"use client";

import type { ExecutiveData } from "./page";

// ── Formatting ──────────────────────────────────────
function fmt(n: number) {
  const abs = Math.abs(n);
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtK(n: number) {
  const abs = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return s + "$" + (abs / 1e6).toFixed(1) + "M";
  if (abs >= 1_000) return s + "$" + (abs / 1e3).toFixed(1) + "K";
  return s + "$" + abs.toFixed(0);
}
function fmtPct(n: number) { return (n * 100).toFixed(1) + "%"; }

function mColor(val: number, min: number) {
  if (val >= min) return "text-green-700";
  if (val >= min * 0.7) return "text-amber-600";
  return "text-red-600";
}

const FARM_ACRES = 0.5;

const YC: Record<string, string> = { "2024": "#9ca3af", "2025": "#00774A", "2026": "#F0B530" };
function yc(y: string) { return YC[y] ?? "#6b7280"; }

// ── Main dashboard ──────────────────────────────────
export default function ExecutiveDashboard({ data }: { data: ExecutiveData }) {
  const fy = data.annualSummaries;
  const byYear: Record<string, (typeof fy)[0]> = {};
  for (const a of fy) byYear[a.year] = a;
  const years = fy.map((a) => a.year).sort();

  const latest = byYear["2025"] ?? byYear[years[years.length - 1]];
  const productionPerAcre = latest ? latest.revenue / FARM_ACRES : 0;

  // Restaurant names
  const allRestaurants = Array.from(
    new Set(data.restaurantByYear.flatMap((r) => Object.keys(r.by_restaurant)))
  );
  const restByYear: Record<string, Record<string, number>> = {};
  for (const r of data.restaurantByYear) restByYear[r.year] = r.by_restaurant;

  return (
    <div className="exec-report px-4 py-4">
      {/* ── Print-only header ── */}
      <div className="hidden print:block mb-2">
        <div className="flex justify-between items-end border-b-2 border-black pb-1">
          <div>
            <h1 className="text-base font-bold tracking-wide" style={{ fontFamily: "'BankGothic Lt BT', 'Bank Gothic', Arial, sans-serif" }}>
              PRESS FARM
            </h1>
            <p className="text-[7px] text-gray-500 tracking-wider uppercase">Executive Summary</p>
          </div>
          <p className="text-[7px] text-gray-400">
            Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── Row 1: KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <KpiCard
          label={latest ? `FY${latest.year} Revenue` : "Revenue"}
          value={latest ? fmtK(latest.revenue) : "—"}
          sub={data.yoyGrowth !== null ? `${data.yoyGrowth >= 0 ? "+" : ""}${data.yoyGrowth.toFixed(0)}% YoY` : undefined}
          subColor={data.yoyGrowth && data.yoyGrowth >= 0 ? "text-green-600" : "text-red-500"}
        />
        <KpiCard
          label="Net Income"
          value={latest ? fmtK(latest.net_income) : "—"}
          sub={latest ? `${fmtPct(latest.net_margin)} margin` : undefined}
          dark
        />
        <KpiCard
          label="Production/Acre"
          value={latest ? fmtK(productionPerAcre) : "—"}
          sub={productionPerAcre >= 100_000 ? "Above $100K target" : "Below $100K target"}
          subColor={productionPerAcre >= 100_000 ? "text-green-600" : "text-amber-600"}
          green
        />
        <KpiCard
          label="Most Ordered"
          value={data.topItemName}
          sub="by quantity"
          isText
        />
      </div>

      {/* ── Row 2: P&L (2/3) + Restaurant & Benchmarks (1/3) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2 mb-2">
        <CompactPL years={years} byYear={byYear} />
        <div className="flex flex-col gap-2">
          <CompactRestaurant years={years} allRestaurants={allRestaurants} restByYear={restByYear} />
          <CompactBenchmarks years={years} byYear={byYear} />
        </div>
      </div>

      {/* ── Row 3: Top items + Expenses (3 col) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <CompactTopItems items={data.topItemsByRevenue.slice(0, 10)} title="Top 10 by Revenue" sortKey="revenue" />
        <CompactTopItems items={data.topItemsByQty.slice(0, 10)} title="Top 10 by Quantity" sortKey="qty" />
        <CompactExpenses categories={data.expenseCategories} />
      </div>
    </div>
  );
}

// ── KPI card ────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, dark, green, isText }: {
  label: string; value: string; sub?: string; subColor?: string;
  dark?: boolean; green?: boolean; isText?: boolean;
}) {
  const bg = dark ? "bg-[#212326] text-white" : green ? "bg-farm-green text-white" : "bg-white border border-gray-100";
  return (
    <div className={`rounded-lg px-3 py-2.5 ${bg} print:py-1.5 print:px-2`}>
      <p className={`text-[9px] uppercase tracking-wider ${dark ? "text-gray-400" : green ? "text-green-200" : "text-gray-400"} print:text-[7px]`}>{label}</p>
      <p className={`${isText ? "text-xs" : "text-lg"} font-bold leading-tight mt-0.5 ${dark ? "text-[#F0B530]" : green ? "text-white" : "text-gray-900"} print:text-sm`}>{value}</p>
      {sub && <p className={`text-[9px] mt-0.5 ${subColor ?? (dark ? "text-gray-400" : "text-gray-400")} print:text-[7px]`}>{sub}</p>}
    </div>
  );
}

// ── Compact P&L table ───────────────────────────────
function CompactPL({ years, byYear }: { years: string[]; byYear: Record<string, ExecutiveData["annualSummaries"][0]> }) {
  type Row = { label: string; key: keyof ExecutiveData["annualSummaries"][0]; isMoney: boolean; isPct: boolean; bold?: boolean; dark?: boolean };
  const rows: Row[] = [
    { label: "Revenue", key: "revenue", isMoney: true, isPct: false, bold: true },
    { label: "Expenses (COGS)", key: "expenses", isMoney: true, isPct: false },
    { label: "Gross Profit", key: "gross_profit", isMoney: true, isPct: false, bold: true },
    { label: "Gross Margin", key: "gross_margin", isMoney: false, isPct: true },
    { label: "Farmer Pay", key: "farmer_pay", isMoney: true, isPct: false },
    { label: "Operating Profit", key: "operating_profit", isMoney: true, isPct: false, bold: true },
    { label: "Op. Margin", key: "operating_margin", isMoney: false, isPct: true },
    { label: "Net Income", key: "net_income", isMoney: true, isPct: false, dark: true },
    { label: "Net Margin", key: "net_margin", isMoney: false, isPct: true, dark: true },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto text-[11px] print:text-[8px]">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="font-semibold text-gray-700 text-xs print:text-[8px]">Annual P&amp;L</span>
        <span className="text-[9px] text-gray-400 print:text-[7px]">All figures USD</span>
      </div>
      {/* Header */}
      <div className="grid px-3 py-1 bg-gray-50/50 border-b border-gray-50" style={{ gridTemplateColumns: `1fr ${years.map(() => "80px").join(" ")}` }}>
        <span />
        {years.map((y) => (
          <span key={y} className="text-right font-semibold" style={{ color: yc(y) }}>
            FY{y}{y === "2026" ? " YTD" : ""}
          </span>
        ))}
      </div>
      {/* Rows */}
      {rows.map((r) => (
        <div
          key={r.label}
          className={`grid px-3 py-1 border-b border-gray-50 last:border-0 items-center
            ${r.dark ? "bg-[#212326] text-white" : r.bold ? "bg-green-50/40" : ""}`}
          style={{ gridTemplateColumns: `1fr ${years.map(() => "80px").join(" ")}` }}
        >
          <span className={`${r.dark ? "text-gray-300" : "text-gray-600"} ${r.bold ? "font-semibold" : ""}`}>{r.label}</span>
          {years.map((y) => {
            const s = byYear[y];
            if (!s) return <span key={y} className="text-right text-gray-300">—</span>;
            const val = s[r.key] as number;
            if (r.isPct) {
              return <span key={y} className={`text-right font-medium ${r.dark ? "text-[#F0B530]" : mColor(val, r.key === "gross_margin" ? 0.5 : r.key === "operating_margin" ? 0.3 : 0.2)}`}>{fmtPct(val)}</span>;
            }
            const isExp = r.key === "expenses" || r.key === "farmer_pay";
            return (
              <span key={y} className={`text-right font-medium ${
                r.dark ? (val < 0 ? "text-red-400" : "text-[#F0B530]")
                : isExp ? "text-red-600" : r.bold ? "text-green-700" : "text-gray-800"
              }`}>
                {isExp ? fmt(-val) : fmt(val)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Compact Restaurant table ────────────────────────
function CompactRestaurant({ years, allRestaurants, restByYear }: {
  years: string[]; allRestaurants: string[]; restByYear: Record<string, Record<string, number>>;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto text-[11px] print:text-[8px]">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <span className="font-semibold text-gray-700 text-xs print:text-[8px]">Revenue by Restaurant</span>
      </div>
      <div className="grid px-3 py-1 bg-gray-50/50 border-b border-gray-50" style={{ gridTemplateColumns: `1fr ${years.map(() => "64px").join(" ")}` }}>
        <span />
        {years.map((y) => <span key={y} className="text-right font-semibold" style={{ color: yc(y) }}>{y}</span>)}
      </div>
      {allRestaurants.map((name) => (
        <div key={name} className="grid px-3 py-1 border-b border-gray-50 last:border-0" style={{ gridTemplateColumns: `1fr ${years.map(() => "64px").join(" ")}` }}>
          <span className="text-gray-700 font-medium truncate">{name}</span>
          {years.map((y) => {
            const v = restByYear[y]?.[name] ?? 0;
            return <span key={y} className={`text-right font-medium ${v > 0 ? "text-green-700" : "text-gray-300"}`}>{v > 0 ? fmtK(v) : "—"}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

// ── Compact Benchmarks ──────────────────────────────
function CompactBenchmarks({ years, byYear }: { years: string[]; byYear: Record<string, ExecutiveData["annualSummaries"][0]> }) {
  const brows = [
    { label: "Gross Margin", target: "50–70%", min: 0.5, get: (s: ExecutiveData["annualSummaries"][0]) => s.gross_margin, isPct: true },
    { label: "Op. Margin", target: "30–50%", min: 0.3, get: (s: ExecutiveData["annualSummaries"][0]) => s.operating_margin, isPct: true },
    { label: "Net Margin", target: "20–40%", min: 0.2, get: (s: ExecutiveData["annualSummaries"][0]) => s.net_margin, isPct: true },
    { label: "Prod./Acre", target: "$100K", min: 100_000, get: (s: ExecutiveData["annualSummaries"][0]) => s.revenue / FARM_ACRES, isPct: false },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto text-[11px] print:text-[8px]">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <span className="font-semibold text-gray-700 text-xs print:text-[8px]">Benchmarks vs Industry</span>
      </div>
      <div className="grid px-3 py-1 bg-gray-50/50 border-b border-gray-50" style={{ gridTemplateColumns: `1fr 44px ${years.map(() => "52px").join(" ")}` }}>
        <span />
        <span className="text-center text-gray-400">Tgt</span>
        {years.map((y) => <span key={y} className="text-right font-semibold" style={{ color: yc(y) }}>{y}</span>)}
      </div>
      {brows.map((r) => (
        <div key={r.label} className="grid px-3 py-1 border-b border-gray-50 last:border-0" style={{ gridTemplateColumns: `1fr 44px ${years.map(() => "52px").join(" ")}` }}>
          <span className="text-gray-600">{r.label}</span>
          <span className="text-center text-gray-400">{r.target}</span>
          {years.map((y) => {
            const s = byYear[y];
            if (!s) return <span key={y} className="text-right text-gray-300">—</span>;
            const val = r.get(s);
            const color = r.isPct ? mColor(val, r.min) : (val >= r.min ? "text-green-700" : "text-amber-600");
            return <span key={y} className={`text-right font-medium ${color}`}>{r.isPct ? fmtPct(val) : fmtK(val)}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

// ── Compact Top Items ───────────────────────────────
function CompactTopItems({ items, title, sortKey }: {
  items: ExecutiveData["topItemsByRevenue"]; title: string; sortKey: "revenue" | "qty";
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto text-[11px] print:text-[8px]">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <span className="font-semibold text-gray-700 text-xs print:text-[8px]">{title}</span>
      </div>
      <div className="grid px-3 py-1 bg-gray-50/50 border-b border-gray-50 font-semibold text-gray-400" style={{ gridTemplateColumns: "16px 1fr 52px 40px" }}>
        <span>#</span>
        <span>Item</span>
        <span className="text-right">Rev</span>
        <span className="text-right">Qty</span>
      </div>
      {items.map((item, i) => (
        <div key={item.item_id} className="grid px-3 py-0.5 border-b border-gray-50 last:border-0 items-center" style={{ gridTemplateColumns: "16px 1fr 52px 40px" }}>
          <span className="text-gray-300">{i + 1}</span>
          <span className="text-gray-800 truncate pr-1">{item.name}</span>
          <span className={`text-right font-medium ${sortKey === "revenue" ? "text-green-700" : "text-gray-600"}`}>{fmtK(item.total_revenue)}</span>
          <span className={`text-right font-medium ${sortKey === "qty" ? "text-green-700" : "text-gray-600"}`}>{item.total_qty.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Compact Expenses ────────────────────────────────
function CompactExpenses({ categories }: { categories: ExecutiveData["expenseCategories"] }) {
  const total = categories.reduce((s, e) => s + e.total, 0);
  return (
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto text-[11px] print:text-[8px]">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex justify-between">
        <span className="font-semibold text-gray-700 text-xs print:text-[8px]">Expenses</span>
        <span className="font-semibold text-red-600 text-xs print:text-[8px]">{fmt(total)}</span>
      </div>
      {categories.map((e) => (
        <div key={e.category} className="grid px-3 py-0.5 border-b border-gray-50 last:border-0" style={{ gridTemplateColumns: "1fr 36px 60px" }}>
          <span className="text-gray-700 truncate">{e.category}</span>
          <span className="text-right text-gray-400">{e.pct.toFixed(0)}%</span>
          <span className="text-right font-medium text-red-600">{fmtK(e.total)}</span>
        </div>
      ))}
    </div>
  );
}
