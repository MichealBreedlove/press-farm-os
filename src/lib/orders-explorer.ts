/**
 * Orders "Explore" view — period resolution. Pure; tested in
 * tests/lib/orders-explorer.test.ts.
 */

import { todayPacific } from "@/lib/utils";

export type PeriodKey =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

export const PERIOD_KEYS: Exclude<PeriodKey, "custom">[] = [
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
];

export const PERIOD_LABELS: Record<Exclude<PeriodKey, "custom">, string> = {
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
  last_year: "Last Year",
};

export function parsePeriod(raw: string | undefined): PeriodKey {
  return raw && ([...PERIOD_KEYS, "custom"] as string[]).includes(raw) ? (raw as PeriodKey) : "this_month";
}

/** Local YYYY-MM-DD (timezone-safe — formats from local date parts). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Resolve a period key (anchored to `todayIso`, farm-local by default) into
 * an inclusive [from, to] YYYY-MM-DD range. Weeks run Monday → Sunday.
 */
export function resolvePeriod(
  period: PeriodKey,
  customFrom?: string,
  customTo?: string,
  todayIso: string = todayPacific(),
): { from: string; to: string } {
  const today = new Date(todayIso + "T12:00:00");
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (period) {
    case "this_week": {
      const offset = (today.getDay() + 6) % 7; // days since Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() - offset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: ymd(monday), to: ymd(sunday) };
    }
    case "last_week": {
      const offset = (today.getDay() + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - offset - 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: ymd(monday), to: ymd(sunday) };
    }
    case "last_month":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "this_year":
      return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 11, 31)) };
    case "last_year":
      return { from: ymd(new Date(y - 1, 0, 1)), to: ymd(new Date(y - 1, 11, 31)) };
    case "custom": {
      const from = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : ymd(new Date(y, m, 1));
      const to = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : ymd(new Date(y, m + 1, 0));
      return from <= to ? { from, to } : { from: to, to: from };
    }
    case "this_month":
    default:
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
  }
}

export function rangeLabel(from: string, to: string): string {
  const f = new Date(from + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const t = new Date(to + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${f} – ${t}`;
}
