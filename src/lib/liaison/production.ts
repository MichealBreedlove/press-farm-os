/**
 * Farm Liaison "Production" numbers — how much product the farm brought in
 * and what it was worth. Source of truth is `delivery_items` (Business Rule
 * 4), never orders. The aggregation is pure so it is unit-tested
 * (tests/lib/liaison-production.test.ts); the loader lives in ./server.ts.
 */

export interface ProductionLine {
  /** Delivery date, YYYY-MM-DD. */
  date: string;
  deliveryId: string;
  restaurant: string;
  item: string;
  quantity: number;
  unit: string;
  total: number;
}

export interface PeriodSummary {
  /** Dollar value delivered. */
  total: number;
  /** Product lines delivered (one item on one delivery). */
  lines: number;
  /** Separate drop-offs. */
  deliveries: number;
  byRestaurant: { name: string; total: number; lines: number }[];
}

export interface ProductionSummary {
  thisMonth: PeriodSummary;
  lastMonth: PeriodSummary;
  yearToDate: PeriodSummary;
  /** Last six calendar months, oldest first, for the trend bars. */
  months: { key: string; label: string; total: number }[];
  /** Top items over the last 30 days by value. */
  topItems: { name: string; total: number; quantity: string }[];
  /** Most recent drop-offs, newest first. */
  recent: { date: string; restaurant: string; total: number; lines: number }[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function summarize(lines: ProductionLine[]): PeriodSummary {
  const byRestaurant = new Map<string, { total: number; lines: number }>();
  const deliveries = new Set<string>();
  let total = 0;
  for (const l of lines) {
    total += l.total;
    deliveries.add(l.deliveryId);
    const r = byRestaurant.get(l.restaurant) ?? { total: 0, lines: 0 };
    r.total += l.total;
    r.lines += 1;
    byRestaurant.set(l.restaurant, r);
  }
  return {
    total,
    lines: lines.length,
    deliveries: deliveries.size,
    byRestaurant: Array.from(byRestaurant, ([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
  };
}

/** "12 LG · 4 SM" — quantities never add across different units. */
function quantityLabel(byUnit: Map<string, number>): string {
  return Array.from(byUnit)
    .sort((a, b) => b[1] - a[1])
    .map(([unit, qty]) => `${Number.isInteger(qty) ? qty : qty.toFixed(1)} ${unit.toUpperCase()}`)
    .join(" · ");
}

export function summarizeProduction(lines: ProductionLine[], today: string): ProductionSummary {
  const thisKey = today.slice(0, 7);
  const lastKey = shiftMonth(thisKey, -1);
  const year = today.slice(0, 4);
  // Nothing dated after today counts (a pre-logged future delivery).
  const past = lines.filter((l) => l.date <= today);

  const months = [-5, -4, -3, -2, -1, 0].map((d) => {
    const key = shiftMonth(thisKey, d);
    return {
      key,
      label: MONTH_LABELS[Number(key.slice(5)) - 1],
      total: past.filter((l) => l.date.startsWith(key)).reduce((s, l) => s + l.total, 0),
    };
  });

  const since = addDays(today, -30);
  const items = new Map<string, { total: number; byUnit: Map<string, number> }>();
  for (const l of past) {
    if (l.date <= since) continue;
    const it = items.get(l.item) ?? { total: 0, byUnit: new Map<string, number>() };
    it.total += l.total;
    it.byUnit.set(l.unit, (it.byUnit.get(l.unit) ?? 0) + l.quantity);
    items.set(l.item, it);
  }
  const topItems = Array.from(items, ([name, v]) => ({
    name,
    total: v.total,
    quantity: quantityLabel(v.byUnit),
  }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const drops = new Map<string, { date: string; restaurant: string; total: number; lines: number }>();
  for (const l of past) {
    const d = drops.get(l.deliveryId) ?? { date: l.date, restaurant: l.restaurant, total: 0, lines: 0 };
    d.total += l.total;
    d.lines += 1;
    drops.set(l.deliveryId, d);
  }
  const recent = Array.from(drops.values())
    .sort((a, b) => (a.date === b.date ? a.restaurant.localeCompare(b.restaurant) : b.date.localeCompare(a.date)))
    .slice(0, 8);

  return {
    thisMonth: summarize(past.filter((l) => l.date.startsWith(thisKey))),
    lastMonth: summarize(past.filter((l) => l.date.startsWith(lastKey))),
    yearToDate: summarize(past.filter((l) => l.date.startsWith(year))),
    months,
    topItems,
    recent,
  };
}

/** Earliest date the summary needs: Jan 1 or six months back, whichever is earlier. */
export function productionWindowStart(today: string): string {
  const sixBack = `${shiftMonth(today.slice(0, 7), -5)}-01`;
  const jan1 = `${today.slice(0, 4)}-01-01`;
  return sixBack < jan1 ? sixBack : jan1;
}

// ── Microgreens ──────────────────────────────────────────────────────────

export interface MicrogreenTrayRow {
  crop: string;
  status: string;
  /** Planned harvest date of the tray's batch, when known. */
  plannedHarvest: string | null;
}

export interface MicrogreenStatus {
  /** Trays in the harvesting stage — can be cut today. */
  ready: { crop: string; trays: number }[];
  /** Still growing (blackout / light), with the earliest planned harvest. */
  growing: { crop: string; trays: number; readyOn: string | null }[];
}

export function summarizeMicrogreens(rows: MicrogreenTrayRow[]): MicrogreenStatus {
  const ready = new Map<string, number>();
  const growing = new Map<string, { trays: number; readyOn: string | null }>();
  for (const r of rows) {
    if (r.status === "harvesting") {
      ready.set(r.crop, (ready.get(r.crop) ?? 0) + 1);
    } else if (r.status === "light" || r.status === "blackout" || r.status === "soaking") {
      const g = growing.get(r.crop) ?? { trays: 0, readyOn: null };
      g.trays += 1;
      if (r.plannedHarvest && (!g.readyOn || r.plannedHarvest < g.readyOn)) g.readyOn = r.plannedHarvest;
      growing.set(r.crop, g);
    }
  }
  return {
    ready: Array.from(ready, ([crop, trays]) => ({ crop, trays })).sort((a, b) => a.crop.localeCompare(b.crop)),
    growing: Array.from(growing, ([crop, v]) => ({ crop, ...v })).sort((a, b) =>
      (a.readyOn ?? "9999") === (b.readyOn ?? "9999")
        ? a.crop.localeCompare(b.crop)
        : (a.readyOn ?? "9999").localeCompare(b.readyOn ?? "9999"),
    ),
  };
}
