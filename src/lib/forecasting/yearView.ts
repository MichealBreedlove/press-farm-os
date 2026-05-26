/**
 * Year-view compute for the chef forecast page (/order/forecast).
 *
 * Three pure functions, each owning one data zone:
 *   - historicalWeeks    → past delivery actuals → weekly buckets
 *   - monthDensity       → distinct-item count per month across all zones
 *   - monthSeasonalItems → seasonal hints for a single month, grouped by category
 *
 * No I/O. All Supabase access lives in fetch.ts.
 */

import { addDays, isWithin, toIso } from "./dates";
import type {
  HistoricalDeliveryRow,
  SeasonalItemRow,
  WeekBucket,
  MonthDensity,
  ForecastCalendarEvent,
} from "./types";

/** Monday of the ISO week containing the given ISO date (UTC). */
export function isoWeekStart(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat. Shift so Monday=0.
  const offset = (d.getUTCDay() + 6) % 7;
  return toIso(addDays(iso, -offset));
}

/**
 * Bucket delivery_items by ISO week (Monday-start).
 *
 * Rows outside [from, to] are dropped. Within a week, the same item appearing
 * in multiple rows is summed. Items within a week are sorted by name.
 */
export function historicalWeeks(
  from: string,
  to: string,
  rows: HistoricalDeliveryRow[],
): WeekBucket[] {
  const buckets = new Map<string, Map<string, WeekBucket["items"][number]>>();

  for (const r of rows) {
    if (!isWithin(r.delivery_date, from, to)) continue;
    const weekStart = isoWeekStart(r.delivery_date);
    let week = buckets.get(weekStart);
    if (!week) {
      week = new Map();
      buckets.set(weekStart, week);
    }
    const existing = week.get(r.item_id);
    if (existing) {
      existing.quantity += r.quantity;
    } else {
      week.set(r.item_id, {
        id: r.item_id,
        name: r.item_name,
        category: r.category,
        unit_type: r.unit_type,
        quantity: r.quantity,
        unit: r.unit,
      });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, items]) => ({
      weekStart,
      items: Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * Per-month density across all three data zones for a given calendar year.
 *
 * Returns a 12-element array (month 1..12) with the distinct-item count
 * deduplicated across zones (an item present in both concrete and seasonal
 * counts once for that month). Dedup key is the lowercased item name —
 * ForecastCalendarEvent.refId is a planting/batch id, not an item id, so we
 * cannot join on id across the concrete and seasonal sources.
 *
 * Zone label is the highest-priority zone touching the month — priority
 * order: past > concrete > seasonal > empty.
 */
export function monthDensity(
  year: number,
  sources: {
    past: WeekBucket[];
    concrete: ForecastCalendarEvent[];
    seasonal: SeasonalItemRow[];
  },
): MonthDensity[] {
  // Map<month1..12, Set<dedupKey>>  — dedupKey = lowercased name
  const namesByMonth = new Map<number, Set<string>>();
  // Map<month1..12, Set<zone>>
  const zonesByMonth = new Map<number, Set<"past" | "concrete" | "seasonal">>();

  function addName(month: number, name: string, zone: "past" | "concrete" | "seasonal") {
    if (month < 1 || month > 12) return;
    let s = namesByMonth.get(month);
    if (!s) { s = new Set(); namesByMonth.set(month, s); }
    s.add(name.trim().toLowerCase());
    let z = zonesByMonth.get(month);
    if (!z) { z = new Set(); zonesByMonth.set(month, z); }
    z.add(zone);
  }

  // Past — every week that falls in the target year contributes its items.
  for (const week of sources.past) {
    const d = new Date(week.weekStart + "T00:00:00Z");
    if (d.getUTCFullYear() !== year) continue;
    const month = d.getUTCMonth() + 1;
    for (const it of week.items) addName(month, it.name, "past");
  }

  // Concrete — each event lands on a single date; that's the month it contributes to.
  for (const ev of sources.concrete) {
    const d = new Date(ev.date + "T00:00:00Z");
    if (d.getUTCFullYear() !== year) continue;
    const month = d.getUTCMonth() + 1;
    addName(month, ev.name, "concrete");
  }

  // Seasonal — each item populates its listed months for THIS year.
  for (const item of sources.seasonal) {
    for (const m of item.seasonal_months) addName(m, item.name, "seasonal");
  }

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const names = namesByMonth.get(month);
    const zones = zonesByMonth.get(month);
    let zone: MonthDensity["zone"] = "empty";
    if (zones) {
      if (zones.has("past")) zone = "past";
      else if (zones.has("concrete")) zone = "concrete";
      else if (zones.has("seasonal")) zone = "seasonal";
    }
    return { month, count: names?.size ?? 0, zone };
  });
}

/**
 * Items typically available in a given month, grouped by category.
 *
 * Input items are filtered to those whose seasonal_months array contains the
 * requested month, then bucketed by `category` (null categories go into an
 * "uncategorized" bucket). Within each bucket items are sorted by name.
 */
export function monthSeasonalItems(
  month: number,
  items: SeasonalItemRow[],
): Record<string, Array<{ id: string; name: string; category: string | null }>> {
  const out: Record<string, Array<{ id: string; name: string; category: string | null }>> = {};
  for (const it of items) {
    if (!it.seasonal_months.includes(month)) continue;
    const key = it.category ?? "uncategorized";
    if (!out[key]) out[key] = [];
    out[key].push({ id: it.id, name: it.name, category: it.category });
  }
  for (const arr of Object.values(out)) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}
