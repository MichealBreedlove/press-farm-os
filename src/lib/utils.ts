/**
 * Press Farm OS — Shared Utilities
 */

import { type ClassValue, clsx } from "clsx";

/** Tailwind class merging helper (clsx without twMerge for now) */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a date string for short display.
 * @example formatDate("2026-03-19") → "Mar 19"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
 * Format currency for display.
 * @example formatCurrency(1234.5) → "$1,234.50"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's local date as YYYY-MM-DD.
 */
export function todayISODate(): string {
  return toISODate(new Date());
}

/**
 * Format a date as YYYY-MM (ISO month string).
 */
export function toISOMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get current local month as YYYY-MM.
 */
export function currentISOMonth(): string {
  return toISOMonth(new Date());
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
