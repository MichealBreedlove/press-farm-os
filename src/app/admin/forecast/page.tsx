import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

interface Forecast {
  itemName: string;
  category: string;
  unit: string;
  avgQty: number;
  recentDeliveries: { date: string; qty: number }[];
  trend: "up" | "down" | "flat";
}

/**
 * /admin/forecast — Predicts what to harvest based on past 4 weeks of orders
 * for the same day-of-week.
 *
 * Useful for planning: if Monday usually needs 6 quarts of mustard flowers,
 * cut them Sunday.
 */
export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { date: dateParam } = await searchParams;
  const admin = createAdminClient();

  // Get next upcoming delivery date if no date param
  const today = new Date().toISOString().split("T")[0];
  let targetDate = dateParam;
  if (!targetDate) {
    const { data: nextDate } = await (admin as any)
      .from("delivery_dates")
      .select("date")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .single();
    targetDate = nextDate?.date ?? today;
  }

  const targetDay = new Date(targetDate + "T12:00:00").getDay();

  // Pull recent deliveries from same day-of-week, last 8 weeks
  const cutoff = new Date(targetDate + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - 56); // 8 weeks back
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const { data: deliveryItems } = await (admin as any)
    .from("delivery_items")
    .select(`
      quantity, unit,
      items ( id, name, category, unit_type ),
      deliveries ( delivery_date )
    `)
    .order("deliveries(delivery_date)", { ascending: false });

  // Filter to same day-of-week, after cutoff
  const sameDay = (deliveryItems ?? []).filter((di: any) => {
    const d = di.deliveries?.delivery_date;
    if (!d || d < cutoffStr || d >= targetDate) return false;
    return new Date(d + "T12:00:00").getDay() === targetDay;
  });

  // Aggregate by item name
  const byItem = new Map<string, { itemName: string; category: string; unit: string; entries: { date: string; qty: number }[] }>();
  for (const di of sameDay) {
    const item = di.items;
    if (!item) continue;
    const key = item.name;
    if (!byItem.has(key)) {
      byItem.set(key, {
        itemName: item.name,
        category: item.category,
        unit: di.unit ?? item.unit_type ?? "",
        entries: [],
      });
    }
    byItem.get(key)!.entries.push({ date: di.deliveries.delivery_date, qty: di.quantity });
  }

  // Build forecasts
  const forecasts: Forecast[] = [];
  for (const data of byItem.values()) {
    if (data.entries.length < 2) continue; // Need at least 2 data points
    const totalQty = data.entries.reduce((s, e) => s + e.qty, 0);
    const avgQty = totalQty / data.entries.length;

    // Trend: compare last 2 vs prior 2
    const sorted = [...data.entries].sort((a, b) => b.date.localeCompare(a.date));
    const recent = sorted.slice(0, 2).reduce((s, e) => s + e.qty, 0) / Math.min(2, sorted.length);
    const older = sorted.slice(2, 4);
    const olderAvg = older.length > 0 ? older.reduce((s, e) => s + e.qty, 0) / older.length : recent;
    let trend: "up" | "down" | "flat" = "flat";
    if (recent > olderAvg * 1.15) trend = "up";
    else if (recent < olderAvg * 0.85) trend = "down";

    forecasts.push({
      itemName: data.itemName,
      category: data.category,
      unit: data.unit,
      avgQty,
      recentDeliveries: sorted.slice(0, 4),
      trend,
    });
  }

  forecasts.sort((a, b) => b.avgQty - a.avgQty);

  // Group by category
  const byCategory: Record<string, Forecast[]> = {};
  for (const f of forecasts) {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  }

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">←</Link>
          <div>
            <h1 className="page-title">Harvest Forecast</h1>
            <p className="text-xs text-white/60">For {formatDate(targetDate)} ({DAY_NAMES[targetDay]})</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 space-y-4">
        <div className="card p-4 bg-blue-50/40 border-blue-100">
          <p className="text-sm text-blue-900">
            📊 Based on the average of recent <strong>{DAY_NAMES[targetDay]}</strong> deliveries (past 8 weeks).
          </p>
          <p className="text-xs text-blue-700 mt-1.5">
            Use this as a guide for what to harvest. Actual orders may vary.
          </p>
        </div>

        {forecasts.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">
            Not enough delivery history yet. Forecast needs at least 2 deliveries per item on this day-of-week.
          </p>
        ) : (
          Object.entries(byCategory).map(([cat, items]) => (
            <section key={cat}>
              <p className="section-eyebrow with-flower text-farm-muted mb-3">
                {cat}
              </p>
              <div className="card overflow-hidden">
                {items.map((f) => (
                  <div key={f.itemName} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{f.itemName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {f.recentDeliveries.length} past {DAY_NAMES[targetDay]}{f.recentDeliveries.length === 1 ? "" : "s"}: {" "}
                          {f.recentDeliveries.map((e) => e.qty).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-farm-green">~{f.avgQty < 1 ? f.avgQty.toFixed(1) : Math.round(f.avgQty)}</span>
                          <span className="text-xs text-gray-400">{f.unit}</span>
                          {f.trend === "up" && <span className="text-xs text-farm-green ml-1">↗</span>}
                          {f.trend === "down" && <span className="text-xs text-orange-500 ml-1">↘</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
