import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { PrintButton } from "@/components/shared/PrintButton";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { rollupByMonth } from "@/lib/reports/aggregate";
import { todayPacific } from "@/lib/utils";

const ReportsDashboard = dynamic(() => import("./ReportsDashboard"), { ssr: false });

interface ReportLink {
  href: string;
  title: string;
  blurb: string;
  /** Executive gets a stronger card — it's the one printed for partners. */
  featured?: boolean;
}

const FINANCIAL_REPORTS: ReportLink[] = [
  { href: "/admin/reports/executive", title: "Executive Summary", blurb: "One-page P&L · YoY growth · Top items · Benchmarks", featured: true },
  { href: "/admin/reports/income", title: "Income Statement", blurb: "Quarterly P&L · Farmer pay · Margin benchmarks" },
  { href: "/admin/reports/yoy", title: "Year over Year", blurb: "Revenue + expense change by month and quarter" },
];

const OPERATIONS_REPORTS: ReportLink[] = [
  { href: "/admin/reports/items", title: "Item Performance", blurb: "Top revenue · Reliable sellers · Dead stock · 30 / 90 / 365-day window" },
  { href: "/admin/reports/crops", title: "Crop Revenue", blurb: "Per-crop ranking · Revenue · Units · $/unit · by year and category" },
  { href: "/admin/reports/labor-efficiency", title: "Labor per Delivery", blurb: "Weekly labor cost vs. delivery throughput" },
  { href: "/admin/reports/production-value", title: "Production Value", blurb: "Self-harvest value · microgreens + planter boxes · separate from orders" },
];

function ReportCard({ href, title, blurb, featured }: ReportLink) {
  return (
    <Link
      href={href}
      className={`card-interactive flex items-center justify-between px-4 py-4 min-h-[64px] ${
        featured ? "border-farm-green/40 ring-1 ring-farm-green/15" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-farm-dark">{title}</p>
        <p className="text-xs text-farm-muted mt-0.5">{blurb}</p>
      </div>
      <span className="text-[10px] tracking-[0.14em] uppercase text-farm-muted/70 flex-shrink-0 ml-3">Print ›</span>
    </Link>
  );
}

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const today = todayPacific();
  const currentMonth = today.slice(0, 7);

  // Fetch historical delivery + expense totals (bounded tables) and the
  // per-item revenue rollup (pre-aggregated in SQL by report_item_revenue —
  // see migration 065 — so we transfer ~hundreds of item rows, not the full
  // delivery_items history).
  const [{ data: deliveries }, { data: expenses }, { data: topItemRows }] = await Promise.all([
    admin
      .from("deliveries")
      .select("delivery_date, total_value, restaurant_id, status, restaurants(name)")
      .order("delivery_date", { ascending: true }),

    admin
      .from("farm_expenses")
      .select("date, amount, category")
      .order("date", { ascending: true }),

    admin
      .from("report_item_revenue")
      .select("*")
      .order("total_revenue", { ascending: false })
      .limit(15),
  ]);

  // Aggregate monthly data (all time) — shared rollup in lib/reports/aggregate.
  const monthMap = rollupByMonth(
    deliveries ?? [],
    expenses ?? [],
    (d) => (d.restaurants as any)?.name ?? "Unknown",
  );

  const allMonthlyData = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      const [y, mo] = m.month.split("-").map(Number);
      const label = new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return { ...m, label, net_value: m.total_value - m.total_expenses };
    });

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

  // Top items (all time) — already grouped + ordered by SQL (migration 065).
  const topItems = (topItemRows ?? []).map((r: any) => ({
    item_id: r.item_id,
    name: r.name,
    category: r.category,
    unit: r.unit_type,
    total_value: Number(r.total_revenue ?? 0),
    total_qty: Number(r.total_qty ?? 0),
  }));

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
      <EditorialHero
        eyebrow="Reports & Analytics"
        title="By the Numbers"
        subtitle="Revenue, expenses, year-over-year growth, and benchmarks"
        flower="green-leaf"
        backHref="/admin/dashboard"
        accessory={<PrintButton />}
      />

      {/* Every report, in one place. Each is its own page with its own
          Print button — Micheal prints them separately, so nothing here is
          folded together. */}
      <div className="px-4 pt-4 space-y-5">
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-2">Financial statements</p>
          <div className="space-y-2">
            {FINANCIAL_REPORTS.map((r) => (
              <ReportCard key={r.href} {...r} />
            ))}
          </div>
        </section>
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-2">Operations</p>
          <div className="space-y-2">
            {OPERATIONS_REPORTS.map((r) => (
              <ReportCard key={r.href} {...r} />
            ))}
          </div>
        </section>
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
