/**
 * Press Farm OS — Shared Utilities
 */

import { type ClassValue, clsx } from "clsx";

/** Tailwind class merging helper (clsx without twMerge for now) */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a date string for display.
 * @example formatDeliveryDate("2026-03-19") → "Thursday, Mar 19"
 */
export function formatDeliveryDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // noon UTC to avoid timezone issues
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date as a short label.
 * @example formatDateShort("2026-03-19") → "Thu, Mar 19"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format currency for display (cents precision).
 * @example formatCurrency(1234.5) → "$1,234.50"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Format currency rounded to whole dollars — the dashboard / report convention
 * where cents are noise. Byte-identical to the `maximumFractionDigits: 0`
 * formatter that was previously redefined as a local `fmt()` in ~half a dozen
 * report and dashboard files.
 * @example formatCurrencyWhole(1234.5) → "$1,235"
 */
export function formatCurrencyWhole(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a decimal quantity for display (trim trailing zeros).
 * @example formatQty(1.5) → "1.5"
 * @example formatQty(2.0) → "2"
 */
export function formatQty(qty: number): string {
  return qty % 1 === 0 ? qty.toString() : qty.toFixed(1);
}

/**
 * Get the next upcoming delivery dates (Thu/Sat/Mon) from today.
 * Returns the next N delivery dates.
 */
export function getNextDeliveryDates(count = 3): Date[] {
  const deliveryDays = [1, 4, 6]; // Mon=1, Thu=4, Sat=6 (JS: Sun=0)
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = new Date(today);
  while (dates.length < count) {
    current.setDate(current.getDate() + 1);
    if (deliveryDays.includes(current.getDay())) {
      dates.push(new Date(current));
    }
  }
  return dates;
}

/**
 * Format a date as YYYY-MM-DD (ISO date string).
 */
export function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Today's date (YYYY-MM-DD) in the farm's timezone (America/Los_Angeles).
 * Use this instead of `new Date().toISOString().split("T")[0]` for any
 * "is this date today/past/future" check — UTC flips to the next day at
 * 4–5pm Pacific, exactly when chefs are ordering for tomorrow.
 */
export function todayPacific(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

/**
 * Get month/year label for reporting.
 * @example formatMonthYear("2026-02-01") → "February 2026"
 */
export function formatMonthYear(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Determine quarter from a date string.
 * @example getQuarter("2026-03-19") → "Q1 2026"
 */
export function getQuarter(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const month = date.getMonth(); // 0-based
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

/**
 * Calculate percentage change between two values.
 */
export function percentChange(prev: number, curr: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

/**
 * Format percentage change with sign.
 * @example formatPercentChange(15.5) → "+15.5%"
 */
export function formatPercentChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

/** Parse a comma-separated unit_type field into individual unit codes. */
export function parseUnits(unitType: string | null | undefined): string[] {
  return String(unitType ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

/**
 * Resolve the price an item charges for a particular unit.
 * Lookup order: items.unit_prices[unit] → items.default_price → null.
 */
export function priceForUnit(
  item: { default_price?: number | null; unit_prices?: Record<string, number> | null },
  unit: string | null | undefined,
): number | null {
  const u = (unit ?? "").trim();
  const map = item.unit_prices ?? null;
  if (u && map && typeof map[u] === "number") return map[u];
  return item.default_price ?? null;
}
