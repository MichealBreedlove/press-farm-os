/**
 * UTC-anchored ISO-date helpers for the forecasting lib.
 *
 * These mirror the helpers used in src/lib/microgreens/sowPlan.ts so date math
 * behaves identically across the two modules. All dates are "YYYY-MM-DD"
 * strings; arithmetic is done at UTC midnight to dodge timezone drift.
 */

const MS_PER_DAY = 24 * 3600 * 1000;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Format a Date as a UTC "YYYY-MM-DD" string. */
export function isoDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Add (or subtract, if negative) whole days to an ISO date string. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateUtc(d);
}

/** Whole-day signed difference toIso - fromIso. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** True when `iso` falls within [start, end] inclusive (all ISO dates). */
export function isWithin(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

/** Coerce a Date | string into an ISO date string (UTC). */
export function toIso(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : isoDateUtc(d);
}
