import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { PrintButton } from "@/components/shared/PrintButton";

interface Props {
  searchParams: Promise<{ year?: string }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmt2(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Returns the Monday (ISO week start) for the given date as YYYY-MM-DD.
 * Matches Postgres `date_trunc('week', date)` behavior.
 */
function weekStartISO(d: Date): string {
  const day = d.getUTCDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // Mon = 1
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function weekLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(d)} – ${fmt(end)}`;
}

/**
 * /admin/reports/labor-efficiency — Labor cost per delivery (per-week)
 *
 * For each ISO week (Mon–Sun) shows: labor hours, labor cost, deliveries
 * in that week, and labor cost / delivery. The ratio is the key signal —
 * trending up means deliveries are getting more expensive to produce
 * (more harvest hours per shipment), trending down means efficiency gains.
 */
export default async function LaborEfficiencyReportPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const now = new Date();

  const yearFilter = yearParam ?? "current";
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  if (/^\d{4}$/.test(yearFilter)) {
    dateFrom = `${yearFilter}-01-01`;
    dateTo = `${yearFilter}-12-31`;
  } else if (yearFilter === "current") {
    dateFrom = `${now.getFullYear()}-01-01`;
    dateTo = `${now.getFullYear()}-12-31`;
  }

  let laborQ = (admin as any)
    .from("labor_entries")
    .select("date, hours, hourly_rate, worker_name");
  if (dateFrom && dateTo) laborQ = laborQ.gte("date", dateFrom).lte("date", dateTo);
  const { data: labor } = await laborQ;

  let deliveryQ = (admin as any)
    .from("deliveries")
    .select("delivery_date, total_value, status");
  if (dateFrom && dateTo) {
    deliveryQ = deliveryQ.gte("delivery_date", dateFrom).lte("delivery_date", dateTo);
  }
  const { data: deliveries } = await deliveryQ;

  // Aggregate by ISO week start
  type WeekAgg = {
    week_start: string;
    labor_hours: number;
    labor_cost: number;
    delivery_count: number;
    delivery_revenue: number;
  };
  const weekMap: Record<string, WeekAgg> = {};
  const blank = (week: string): WeekAgg => ({
    week_start: week,
    labor_hours: 0,
    labor_cost: 0,
    delivery_count: 0,
    delivery_revenue: 0,
  });

  for (const l of (labor as any[]) ?? []) {
    const d = new Date(l.date + "T12:00:00Z");
    const w = weekStartISO(d);
    weekMap[w] ??= blank(w);
    const hrs = Number(l.hours ?? 0);
    const rate = Number(l.hourly_rate ?? 0);
    weekMap[w].labor_hours += hrs;
    weekMap[w].labor_cost += hrs * rate;
  }

  for (const d of (deliveries as any[]) ?? []) {
    const dt = new Date(d.delivery_date + "T12:00:00Z");
    const w = weekStartISO(dt);
    weekMap[w] ??= blank(w);
    weekMap[w].delivery_count += 1;
    weekMap[w].delivery_revenue += Number(d.total_value ?? 0);
  }

  const rows = Object.values(weekMap)
    .sort((a, b) => b.week_start.localeCompare(a.week_start)) // newest first
    .map((w) => ({
      ...w,
      cost_per_delivery: w.delivery_count > 0 ? w.labor_cost / w.delivery_count : null,
      labor_as_pct_revenue: w.delivery_revenue > 0 ? (w.labor_cost / w.delivery_revenue) * 100 : null,
    }));

  const totalHours = rows.reduce((s, r) => s + r.labor_hours, 0);
  const totalCost = rows.reduce((s, r) => s + r.labor_cost, 0);
  const totalDeliveries = rows.reduce((s, r) => s + r.delivery_count, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.delivery_revenue, 0);
  const avgCostPerDelivery = totalDeliveries > 0 ? totalCost / totalDeliveries : 0;
  const laborPctRevenue = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

  const periodLabel =
    yearFilter === "current" ? `${now.getFullYear()} YTD` : yearFilter;

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Labor Efficiency</h1>
      </header>
      <EditorialHero
        eyebrow="Reports & Analytics"
        title="Labor per Delivery"
        subtitle={`Weekly labor cost vs. delivery throughput · ${periodLabel}`}
        flower="green-leaf"
        backHref="/admin/reports"
        accessory={<PrintButton />}
      />

      {/* Year toggle */}
      <div className="px-4 pt-4 flex flex-wrap gap-2 text-xs">
        {(["current", "2026", "2025"] as const).map((y) => (
          <a
            key={y}
            href={`/admin/reports/labor-efficiency?year=${y}`}
            className={`px-3 py-1.5 rounded-full border ${
              yearFilter === y
                ? "bg-farm-green text-white border-farm-green"
                : "bg-white text-farm-dark border-farm-muted/30"
            }`}
          >
            {y === "current" ? "YTD" : y}
          </a>
        ))}
      </div>

      {/* Period summary */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        <div className="card-soft px-4 py-3">
          <p className="text-xs text-farm-muted uppercase tracking-wide">Avg cost / delivery</p>
          <p className="text-xl font-bold text-farm-dark">{fmt2(avgCostPerDelivery)}</p>
        </div>
        <div className="card-soft px-4 py-3">
          <p className="text-xs text-farm-muted uppercase tracking-wide">Labor % of revenue</p>
          <p className="text-xl font-bold text-farm-dark">{laborPctRevenue.toFixed(1)}%</p>
        </div>
        <div className="card-soft px-4 py-3">
          <p className="text-xs text-farm-muted uppercase tracking-wide">Total hours</p>
          <p className="text-lg font-semibold text-farm-dark">{totalHours.toFixed(1)}h</p>
        </div>
        <div className="card-soft px-4 py-3">
          <p className="text-xs text-farm-muted uppercase tracking-wide">Deliveries</p>
          <p className="text-lg font-semibold text-farm-dark">{totalDeliveries}</p>
        </div>
      </div>

      {/* Weekly table */}
      <div className="px-4 pt-4">
        {rows.length === 0 ? (
          <p className="text-sm text-farm-muted py-8 text-center">No data in this period.</p>
        ) : (
          <div className="card-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-farm-muted uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Week</th>
                  <th className="text-right px-3 py-2">Hours</th>
                  <th className="text-right px-3 py-2">Labor</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Deliv.</th>
                  <th className="text-right px-3 py-2">$/deliv.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.week_start} className="border-t border-farm-muted/10">
                    <td className="px-3 py-2 text-farm-dark">{weekLabel(r.week_start)}</td>
                    <td className="text-right px-3 py-2">{r.labor_hours.toFixed(1)}</td>
                    <td className="text-right px-3 py-2 text-farm-dark">{fmt(r.labor_cost)}</td>
                    <td className="text-right px-3 py-2 hidden sm:table-cell text-farm-muted">
                      {r.delivery_count}
                    </td>
                    <td className="text-right px-3 py-2 font-semibold text-farm-dark">
                      {r.cost_per_delivery == null ? "—" : fmt2(r.cost_per_delivery)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
