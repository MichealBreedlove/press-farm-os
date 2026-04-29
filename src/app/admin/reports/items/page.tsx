import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "@/components/shared/PrintButton";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

interface ItemStat {
  itemId: string;
  itemName: string;
  category: string;
  totalRevenue: number;
  totalQuantity: number;
  unit: string;
  deliveryCount: number;
  lastDeliveryDate: string;
  averagePerDelivery: number;
}

/**
 * /admin/reports/items — Item Performance report
 *
 * Shows: top revenue items, top quantity items, dead stock (no recent deliveries),
 * and consistent items (delivered every cycle).
 */
export default async function ItemPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { window: windowParam } = await searchParams;
  const days = windowParam === "year" ? 365 : windowParam === "quarter" ? 90 : 30;
  const windowLabel = days === 365 ? "Past Year" : days === 90 ? "Past Quarter" : "Past 30 Days";

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const admin = createAdminClient();

  // Fetch delivery items with details
  const { data: deliveryItems } = await (admin as any)
    .from("delivery_items")
    .select(`
      quantity, unit, unit_price, line_total,
      items ( id, name, category, unit_type, is_archived ),
      deliveries!inner ( delivery_date )
    `)
    .gte("deliveries.delivery_date", cutoffStr);

  // Aggregate by item
  const statsMap = new Map<string, ItemStat>();
  for (const di of deliveryItems ?? []) {
    const item = di.items;
    if (!item || item.is_archived) continue;
    const id = item.id as string;
    const revenue = di.line_total ?? di.quantity * (di.unit_price ?? 0);
    const date = di.deliveries?.delivery_date ?? "";

    if (!statsMap.has(id)) {
      statsMap.set(id, {
        itemId: id,
        itemName: item.name,
        category: item.category,
        totalRevenue: 0,
        totalQuantity: 0,
        unit: di.unit ?? item.unit_type ?? "",
        deliveryCount: 0,
        lastDeliveryDate: "",
        averagePerDelivery: 0,
      });
    }
    const stat = statsMap.get(id)!;
    stat.totalRevenue += revenue;
    stat.totalQuantity += di.quantity;
    stat.deliveryCount += 1;
    if (date > stat.lastDeliveryDate) stat.lastDeliveryDate = date;
  }

  // Calc averages
  for (const stat of statsMap.values()) {
    stat.averagePerDelivery = stat.deliveryCount > 0 ? stat.totalQuantity / stat.deliveryCount : 0;
  }

  const allStats = Array.from(statsMap.values());
  const topRevenue = [...allStats].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
  const topQuantity = [...allStats].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 10);
  const mostFrequent = [...allStats].sort((a, b) => b.deliveryCount - a.deliveryCount).slice(0, 10);

  // Dead stock: items in catalog but NOT in deliveries this window
  const { data: allItems } = await (admin as any)
    .from("items")
    .select("id, name, category")
    .eq("is_archived", false);
  const deliveredIds = new Set(allStats.map((s) => s.itemId));
  const deadStock = (allItems ?? []).filter((i: any) => !deliveredIds.has(i.id));

  const totalRevenue = allStats.reduce((s, x) => s + x.totalRevenue, 0);
  const totalQuantity = allStats.reduce((s, x) => s + x.totalQuantity, 0);
  const uniqueItems = allStats.length;

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/reports" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">←</Link>
          <div className="flex-1">
            <h1 className="page-title">Item Performance</h1>
            <p className="text-xs text-white/60">{windowLabel}</p>
          </div>
          <div className="ml-auto"><PrintButton /></div>
        </div>
      </header>

      <div className="px-4 py-5 space-y-6">
        {/* Window selector */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {[
            { key: "month", label: "30 Days" },
            { key: "quarter", label: "Quarter" },
            { key: "year", label: "Year" },
          ].map((opt) => (
            <Link
              key={opt.key}
              href={`/admin/reports/items?window=${opt.key}`}
              className={`flex-1 text-center min-h-[40px] flex items-center justify-center text-sm font-medium rounded-lg transition-colors ${
                (windowParam ?? "month") === opt.key
                  ? "bg-white text-farm-dark shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-farm-green">{uniqueItems}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Active Items</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-farm-dark">{Math.round(totalQuantity)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Total Units</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-farm-dark">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Revenue</p>
          </div>
        </div>

        {/* Top Revenue */}
        <section>
          <p className="section-eyebrow with-flower text-farm-muted mb-3">
            Top Revenue
          </p>
          <div className="card overflow-hidden">
            {topRevenue.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No deliveries in this window</p>
            ) : (
              topRevenue.map((s, i) => (
                <Link
                  key={s.itemId}
                  href={`/admin/items/${s.itemId}`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
                >
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.itemName}</p>
                    <p className="text-xs text-gray-400">
                      {s.deliveryCount} {s.deliveryCount === 1 ? "delivery" : "deliveries"} · last {formatDate(s.lastDeliveryDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-farm-green">{formatCurrency(s.totalRevenue)}</p>
                    <p className="text-[10px] text-gray-400">{Math.round(s.totalQuantity)} {s.unit}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Most Frequent */}
        <section>
          <p className="section-eyebrow text-farm-muted mb-3">
            Most Frequent (Reliable Sellers)
          </p>
          <div className="card overflow-hidden">
            {mostFrequent.slice(0, 8).map((s, i) => (
              <Link
                key={s.itemId}
                href={`/admin/items/${s.itemId}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
              >
                <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.itemName}</p>
                  <p className="text-xs text-gray-400">
                    avg {s.averagePerDelivery.toFixed(1)} {s.unit} per delivery
                  </p>
                </div>
                <span className="text-sm font-semibold text-blue-600">{s.deliveryCount}×</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Dead Stock */}
        {deadStock.length > 0 && (
          <section>
            <p className="section-eyebrow text-farm-muted mb-3">
              Dead Stock — In Catalog but No Deliveries
            </p>
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-2">
                {deadStock.length} active items haven&apos;t shipped in {windowLabel.toLowerCase()}.
                Consider archiving or re-promoting.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {deadStock.slice(0, 30).map((item: any) => (
                  <Link
                    key={item.id}
                    href={`/admin/items/${item.id}`}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-md transition-colors min-h-0"
                  >
                    {item.name}
                  </Link>
                ))}
                {deadStock.length > 30 && (
                  <span className="text-xs text-gray-400 px-2 py-1">
                    + {deadStock.length - 30} more
                  </span>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
