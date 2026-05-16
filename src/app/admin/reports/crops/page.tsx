import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { PrintButton } from "@/components/shared/PrintButton";

interface Props {
  searchParams: Promise<{ year?: string; category?: string }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtUnit(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * /admin/reports/crops — Per-crop revenue ranking
 *
 * Aggregates delivery_items by item to surface which crops are pulling
 * their weight. Shows total revenue, total units sold, and $/unit average
 * derived from line_total / quantity. No cost subtraction — items don't
 * have a cost_per_unit field, so this is gross revenue ranking, not true
 * margin (decision made 2026-05-15 to avoid a schema change for v1).
 */
export default async function CropRevenueReportPage({ searchParams }: Props) {
  const { year: yearParam, category: categoryParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Year filter — default to all-time, "current" / "2026" allowed
  const now = new Date();
  const yearFilter = yearParam ?? "all";
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  if (/^\d{4}$/.test(yearFilter)) {
    dateFrom = `${yearFilter}-01-01`;
    dateTo = `${yearFilter}-12-31`;
  } else if (yearFilter === "current") {
    dateFrom = `${now.getFullYear()}-01-01`;
    dateTo = `${now.getFullYear()}-12-31`;
  }

  // Pull delivery_items joined to items + deliveries for date filtering.
  let q = (admin as any)
    .from("delivery_items")
    .select(`
      item_id, quantity, line_total,
      items ( name, category, unit_type ),
      deliveries!inner ( delivery_date )
    `);

  if (dateFrom && dateTo) {
    q = q.gte("deliveries.delivery_date", dateFrom).lte("deliveries.delivery_date", dateTo);
  }

  const { data: deliveryItems } = await q;

  // Aggregate
  type Agg = {
    item_id: string;
    name: string;
    category: string;
    unit: string;
    total_revenue: number;
    total_qty: number;
    delivery_count: Set<string>;
  };
  const aggMap: Record<string, Agg> = {};

  for (const di of (deliveryItems as any[]) ?? []) {
    if (!di.items) continue;
    const id = di.item_id;
    if (!aggMap[id]) {
      aggMap[id] = {
        item_id: id,
        name: di.items.name,
        category: di.items.category,
        unit: di.items.unit_type,
        total_revenue: 0,
        total_qty: 0,
        delivery_count: new Set<string>(),
      };
    }
    aggMap[id].total_revenue += Number(di.line_total ?? 0);
    aggMap[id].total_qty += Number(di.quantity ?? 0);
    if (di.delivery_id) aggMap[id].delivery_count.add(di.delivery_id);
  }

  const allCategories = Array.from(new Set(Object.values(aggMap).map((a) => a.category))).sort();

  let rows = Object.values(aggMap)
    .filter((a) => a.total_revenue > 0)
    .map((a) => ({
      ...a,
      delivery_count: a.delivery_count.size,
      avg_per_unit: a.total_qty > 0 ? a.total_revenue / a.total_qty : 0,
    }));

  if (categoryParam && categoryParam !== "all") {
    rows = rows.filter((r) => r.category === categoryParam);
  }

  rows.sort((a, b) => b.total_revenue - a.total_revenue);

  const grandRevenue = rows.reduce((s, r) => s + r.total_revenue, 0);
  const grandQty = rows.reduce((s, r) => s + r.total_qty, 0);

  const periodLabel = !dateFrom
    ? "All time"
    : yearFilter === "current"
    ? `${now.getFullYear()} YTD`
    : yearFilter;

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Crop Revenue</h1>
      </header>
      <EditorialHero
        eyebrow="Reports & Analytics"
        title="Crop Revenue"
        subtitle={`Per-crop revenue ranking · ${periodLabel}`}
        flower="green-leaf"
        backHref="/admin/reports"
        accessory={<PrintButton />}
      />

      {/* Filters */}
      <div className="px-4 pt-4 flex flex-wrap gap-2 text-xs">
        {(["all", "current", "2026", "2025"] as const).map((y) => (
          <a
            key={y}
            href={`/admin/reports/crops?year=${y}${categoryParam ? `&category=${categoryParam}` : ""}`}
            className={`px-3 py-1.5 rounded-full border ${
              yearFilter === y
                ? "bg-farm-green text-white border-farm-green"
                : "bg-white text-farm-dark border-farm-muted/30"
            }`}
          >
            {y === "all" ? "All time" : y === "current" ? "YTD" : y}
          </a>
        ))}
        <span className="mx-1 text-farm-muted/40">·</span>
        <a
          href={`/admin/reports/crops?year=${yearFilter}`}
          className={`px-3 py-1.5 rounded-full border ${
            !categoryParam || categoryParam === "all"
              ? "bg-farm-green text-white border-farm-green"
              : "bg-white text-farm-dark border-farm-muted/30"
          }`}
        >
          All
        </a>
        {allCategories.map((c) => (
          <a
            key={c}
            href={`/admin/reports/crops?year=${yearFilter}&category=${encodeURIComponent(c)}`}
            className={`px-3 py-1.5 rounded-full border ${
              categoryParam === c
                ? "bg-farm-green text-white border-farm-green"
                : "bg-white text-farm-dark border-farm-muted/30"
            }`}
          >
            {c}
          </a>
        ))}
      </div>

      {/* Summary */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        <div className="card-soft px-4 py-3">
          <p className="text-xs text-farm-muted uppercase tracking-wide">Crops</p>
          <p className="text-xl font-bold text-farm-dark">{rows.length}</p>
        </div>
        <div className="card-soft px-4 py-3">
          <p className="text-xs text-farm-muted uppercase tracking-wide">Total Revenue</p>
          <p className="text-xl font-bold text-farm-dark">{fmt(grandRevenue)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 pt-4">
        {rows.length === 0 ? (
          <p className="text-sm text-farm-muted py-8 text-center">No revenue recorded in this period.</p>
        ) : (
          <div className="card-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-farm-muted uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Crop</th>
                  <th className="text-right px-3 py-2">Revenue</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Units</th>
                  <th className="text-right px-3 py-2">$/unit</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Deliveries</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.item_id} className="border-t border-farm-muted/10">
                    <td className="px-3 py-2">
                      <p className="font-medium text-farm-dark">{r.name}</p>
                      <p className="text-xs text-farm-muted">{r.category}</p>
                    </td>
                    <td className="text-right px-3 py-2 font-semibold text-farm-dark">{fmt(r.total_revenue)}</td>
                    <td className="text-right px-3 py-2 hidden sm:table-cell">
                      {r.total_qty.toLocaleString()} <span className="text-xs text-farm-muted">{r.unit}</span>
                    </td>
                    <td className="text-right px-3 py-2 text-farm-dark">{fmtUnit(r.avg_per_unit)}</td>
                    <td className="text-right px-3 py-2 hidden sm:table-cell text-farm-muted">{r.delivery_count}</td>
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
