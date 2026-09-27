/**
 * Press Farm OS — partner (Chef Phil) report: pure helpers.
 *
 * Period ranges and the annual report's derived pieces (year-over-year change,
 * month-by-month bars). No DB access and no `Date.now()` — `today` is passed
 * in — so everything here is unit-testable. The route
 * (`app/api/reports/partner-report`) does the fetching.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export interface YearRange {
  /** inclusive YYYY-MM-DD */
  start: string;
  /** inclusive YYYY-MM-DD — clamped to `today` for the current year */
  end: string;
  /** e.g. "2025", or "2026 (through Sep 27)" for a year still in progress */
  label: string;
  /** YYYY-MM-DD the data runs through when the year isn't finished, else null */
  partialThrough: string | null;
}

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Calendar year `year`. A year that hasn't ended yet (relative to `today`) is
 * clamped to today and labelled as partial, so a mid-year preview never
 * pretends to be a full year.
 */
export function yearRange(year: number, today: string): YearRange {
  const start = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (today < yearEnd && today >= start) {
    return { start, end: today, label: `${year} (through ${shortDay(today)})`, partialThrough: today };
  }
  return { start, end: yearEnd, label: String(year), partialThrough: null };
}

/**
 * The same span one year earlier — the fair comparison window for a
 * year-over-year line (a partial year compares against the same partial
 * stretch last year, not last year's full total).
 */
export function priorYearSpan(range: { start: string; end: string }): { start: string; end: string } {
  const back = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    // Feb 29 → Feb 28 in a non-leap prior year.
    const lastDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
    return `${y - 1}-${pad(m)}-${pad(Math.min(d, lastDay))}`;
  };
  return { start: back(range.start), end: back(range.end) };
}

/** Percent change from `previous` to `current`; null when there's no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface MonthBar {
  /** "Jan" … "Dec" */
  label: string;
  /** dollars delivered that month (0 for future months) */
  value: number;
  /** bar width 0–100, relative to the year's best month */
  pct: number;
  /** month is in progress (the partial-year cutoff falls inside it) */
  partial: boolean;
  /** month hasn't started yet relative to the cutoff */
  future: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Twelve bars for `year` from per-`YYYY-MM` totals. `partialThrough` (the
 * YearRange field) marks the in-progress month and blanks the months after it.
 */
export function buildMonthBars(
  year: number,
  totalsByMonth: Record<string, number>,
  partialThrough: string | null,
): MonthBar[] {
  const cutoffMonth = partialThrough ? Number(partialThrough.slice(5, 7)) : 13;
  const max = Math.max(0, ...MONTHS.map((_, i) => totalsByMonth[`${year}-${pad(i + 1)}`] ?? 0));
  return MONTHS.map((label, i) => {
    const m = i + 1;
    const future = m > cutoffMonth;
    const value = future ? 0 : totalsByMonth[`${year}-${pad(m)}`] ?? 0;
    return {
      label,
      value,
      pct: max > 0 ? Math.round((value / max) * 1000) / 10 : 0,
      partial: m === cutoffMonth,
      future,
    };
  });
}
