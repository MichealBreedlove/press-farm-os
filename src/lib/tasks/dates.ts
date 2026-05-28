/**
 * Date helpers for the tasks system. UTC-anchored to avoid TZ drift between
 * the cron runtime (UTC) and Vermont/California operator time. Tasks are
 * date-only — the user works in days, not minutes — so this is safe.
 */

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / (24 * 3600 * 1000));
}

export function isPastIso(iso: string, now: Date = new Date()): boolean {
  return iso < todayIso(now);
}
