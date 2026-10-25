/**
 * Farmer pay for a date range, from the `farmer_pay_rates` table.
 *
 * Each rate row applies from its effective_date until the next row's:
 *   - flat_quarterly — a fixed amount per quarter, spread evenly over the
 *     quarter's days; only charged in quarters the farm was operating
 *     (`activeQuarters`, e.g. quarters with deliveries).
 *   - hourly_rate × hours_per_week — accrued daily (÷ 7).
 * Pure: callers cap `end` at today so future pay isn't counted.
 */

export interface FarmerPayRate {
  effective_date: string; // YYYY-MM-DD
  hourly_rate: number | string | null;
  hours_per_week: number | string | null;
  flat_quarterly: number | string | null;
}

/** Used when the rates table can't be read: the original $12,000/quarter. */
export const LEGACY_FARMER_PAY_RATES: FarmerPayRate[] = [
  { effective_date: "2000-01-01", hourly_rate: null, hours_per_week: null, flat_quarterly: 12000 },
];

const DAY_MS = 86_400_000;

function toDayNum(d: string): number {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd) / DAY_MS;
}

function quarterOf(dayNum: number): { key: string; days: number } {
  const dt = new Date(dayNum * DAY_MS);
  const y = dt.getUTCFullYear();
  const q = Math.floor(dt.getUTCMonth() / 3) + 1;
  const start = Date.UTC(y, (q - 1) * 3, 1) / DAY_MS;
  const end = Date.UTC(y, q * 3, 1) / DAY_MS;
  return { key: `${y}-Q${q}`, days: end - start };
}

export function quarterKey(date: string): string {
  return quarterOf(toDayNum(date)).key;
}

/** Total farmer pay for the inclusive range [start, end]. */
export function farmerPayForRange(
  rates: FarmerPayRate[],
  start: string,
  end: string,
  activeQuarters: Set<string>,
): number {
  const sorted = [...rates]
    .filter((r) => r.effective_date)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
    .map((r) => ({
      from: toDayNum(r.effective_date),
      flat: r.flat_quarterly != null ? Number(r.flat_quarterly) : null,
      weekly:
        r.hourly_rate != null && r.hours_per_week != null
          ? Number(r.hourly_rate) * Number(r.hours_per_week)
          : null,
    }));
  if (sorted.length === 0) return 0;

  let total = 0;
  const last = toDayNum(end);
  for (let day = toDayNum(start); day <= last; day++) {
    let rate = null as (typeof sorted)[number] | null;
    for (const r of sorted) {
      if (r.from <= day) rate = r;
      else break;
    }
    if (!rate) continue;
    if (rate.flat != null) {
      const q = quarterOf(day);
      if (activeQuarters.has(q.key)) total += rate.flat / q.days;
    } else if (rate.weekly != null) {
      total += rate.weekly / 7;
    }
  }
  return Math.round(total * 100) / 100;
}
