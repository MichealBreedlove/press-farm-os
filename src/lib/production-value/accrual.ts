/**
 * Press Farm OS — production-value accrual (pure core).
 *
 * "Production value" is the farm-internal worth of self-harvested crops that
 * chefs pick on their own — there's no order and no `delivery_items` row, so it
 * never appears in chef order/delivery revenue. Instead each source (a
 * microgreen tray or a planter-box planting) accrues its value evenly,
 * day-by-day, so no single date spikes. These functions are pure and take
 * `today` explicitly (no `Date.now()`), so they're fully testable; the DB
 * fetch + aggregation lives in ./server.ts.
 *
 * All dates are `YYYY-MM-DD` strings compared/advanced in UTC.
 */

/** Default Press/Under-Study split when farm_settings carries no override. */
export const PRODUCTION_VALUE_SPLIT_DEFAULT = { press: 0.75, understudy: 0.25 } as const;

/** Monthly→daily conversion basis (avg days per month over a year). */
const DAYS_PER_MONTH = 365 / 12;

export interface ProductionSplit {
  press: number;
  understudy: number;
}

/** A normalized daily-accrual window for one source. */
export interface DailyAccrual {
  /** inclusive YYYY-MM-DD */
  start: string;
  /** inclusive YYYY-MM-DD (natural end; callers clamp to `today` separately) */
  end: string;
  /** dollars accrued per active day */
  dailyRate: number;
  /** if set, only days whose month (1–12) is listed accrue */
  activeMonths?: number[];
}

// ── Date helpers (UTC, day-granular) ─────────────────────────────────────────
const MS_PER_DAY = 86_400_000;

function toDayNum(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / MS_PER_DAY;
}
function fromDayNum(n: number): string {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}
export function addDays(d: string, n: number): string {
  return fromDayNum(toDayNum(d) + n);
}
/** Inclusive day count between two dates (a..b). */
export function daysInclusive(a: string, b: string): number {
  return toDayNum(b) - toDayNum(a) + 1;
}
function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

// ── Source builders ──────────────────────────────────────────────────────────

/**
 * One microgreen tray. Value accrues evenly over the crop's productive life
 * from `harvestingStart` until terminated (or `today` if still going), capped
 * so a tray never earns more than `valuePerTray`.
 */
export function trayAccrual(input: {
  valuePerTray: number | null | undefined;
  productiveLifeDays: number | null | undefined;
  harvestingStart: string | null | undefined;
  terminatedAt: string | null | undefined;
  today: string;
}): DailyAccrual | null {
  const { valuePerTray, productiveLifeDays, harvestingStart, terminatedAt, today } = input;
  if (!valuePerTray || valuePerTray <= 0) return null;
  if (!productiveLifeDays || productiveLifeDays <= 0) return null;
  if (!harvestingStart) return null;

  const dailyRate = valuePerTray / productiveLifeDays;
  // The cap: accrual covers at most productiveLifeDays days (start inclusive),
  // so the most a tray can earn is dailyRate × productiveLifeDays = valuePerTray.
  const lifeEnd = addDays(harvestingStart, productiveLifeDays - 1);
  const actualEnd = terminatedAt ?? today;
  const end = minDate(lifeEnd, actualEnd);
  if (end < harvestingStart) return null;

  return { start: harvestingStart, end, dailyRate };
}

/**
 * One planter-box planting. Three lifecycles:
 *   annual              — value_amount is a TOTAL spread evenly over planted..end
 *   perennial_evergreen — value_amount is a MONTHLY rate, every day while active
 *   perennial_dormant   — value_amount is a MONTHLY rate, only in seasonalMonths
 */
export function plantingAccrual(input: {
  lifecycle: "annual" | "perennial_evergreen" | "perennial_dormant";
  valueAmount: number | null | undefined;
  plantedDate: string | null | undefined;
  endDate: string | null | undefined;
  seasonalMonths: number[] | null | undefined;
  today: string;
}): DailyAccrual | null {
  const { lifecycle, valueAmount, plantedDate, endDate, seasonalMonths, today } = input;
  if (!valueAmount || valueAmount <= 0) return null;
  if (!plantedDate) return null;

  if (lifecycle === "annual") {
    if (!endDate) return null;
    const days = daysInclusive(plantedDate, endDate);
    if (days <= 0) return null;
    // Spread the total over the FULL window; callers clamp the query range to
    // `today` so only the elapsed portion is counted as realized.
    return { start: plantedDate, end: endDate, dailyRate: valueAmount / days };
  }

  // Perennials: monthly rate → daily. Accrue up to removal (end_date) or today.
  const dailyRate = valueAmount / DAYS_PER_MONTH;
  const end = minDate(endDate ?? today, today);
  if (end < plantedDate) return null;

  const acc: DailyAccrual = { start: plantedDate, end, dailyRate };
  if (lifecycle === "perennial_dormant") {
    acc.activeMonths = seasonalMonths ?? [];
  }
  return acc;
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Value accrued within an inclusive [rangeStart, rangeEnd] window. Iterates
 * day-by-day (data volumes are small) honoring any seasonal-month filter.
 */
export function valueInRange(acc: DailyAccrual, rangeStart: string, rangeEnd: string): number {
  const start = acc.start > rangeStart ? acc.start : rangeStart;
  const end = minDate(acc.end, rangeEnd);
  if (end < start) return 0;

  const months = acc.activeMonths;
  let total = 0;
  for (let n = toDayNum(start); n <= toDayNum(end); n++) {
    if (months && months.length) {
      const month = Number(fromDayNum(n).slice(5, 7));
      if (!months.includes(month)) continue;
    }
    total += acc.dailyRate;
  }
  return total;
}

/**
 * Per-`YYYY-MM` value for a source, from its start through min(end, capEnd).
 * `capEnd` is normally `today` so future/projected days aren't counted.
 */
export function valueByMonth(acc: DailyAccrual, capEnd: string): Record<string, number> {
  const end = minDate(acc.end, capEnd);
  const out: Record<string, number> = {};
  if (end < acc.start) return out;

  const months = acc.activeMonths;
  for (let n = toDayNum(acc.start); n <= toDayNum(end); n++) {
    const day = fromDayNum(n);
    if (months && months.length && !months.includes(Number(day.slice(5, 7)))) continue;
    const key = day.slice(0, 7);
    out[key] = (out[key] ?? 0) + acc.dailyRate;
  }
  return out;
}

/** Split a dollar amount into the Press / Under-Study shares. */
export function splitProductionValue(
  amount: number,
  split: ProductionSplit = PRODUCTION_VALUE_SPLIT_DEFAULT,
): ProductionSplit {
  return { press: amount * split.press, understudy: amount * split.understudy };
}

/** Sum a list of per-month maps into one. */
export function mergeMonthMaps(maps: Array<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}
