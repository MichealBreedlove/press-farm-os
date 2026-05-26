"use client";

import Link from "next/link";
import type { ForecastCalendarEvent } from "@/lib/forecasting";

/**
 * Reusable month-grid calendar for forecast events (field crops + microgreens).
 *
 * Generic — does NOT hardcode any admin route. Used by both the admin
 * harvest-forecast section and the chef Harvest Calendar.
 *
 * Modeled on the admin CalendarGrid + microgreens CalendarView for visual
 * consistency. Month navigation is query-param based (the parent server
 * component recomputes events for the visible month and passes fresh `prevHref`
 * / `nextHref` / `todayHref`), so no client-side data fetching happens here.
 *
 * Events are passed pre-grouped by ISO date. The legend is derived from a
 * caller-supplied `LegendItem[]` so the palette stays in repo tokens and no
 * ad-hoc colors leak in.
 */

/** One swatch + label in the legend, plus the Tailwind chip class events of
 *  this kind render with. Match the kinds you pass via `eventKind`. */
export interface ForecastLegendItem {
  /** Stable key matching what `eventKind(event)` returns. */
  key: string;
  label: string;
  /** Tailwind chip classes used both for the legend swatch and event pills. */
  chipClass: string;
}

interface Props {
  /** Year of the visible month. */
  year: number;
  /** 0-indexed month of the visible month. */
  month: number;
  /** Display label, e.g. "May 2026". */
  monthLabel: string;
  /** Events for the visible month range, grouped by ISO date (YYYY-MM-DD). */
  eventsByDate: Record<string, ForecastCalendarEvent[]>;
  /** Legend / palette definition. */
  legend: ForecastLegendItem[];
  /** Maps an event to a legend key (which decides its chip color). */
  eventKind: (e: ForecastCalendarEvent) => string;
  /** Previous-month href (query-param nav). */
  prevHref: string;
  /** Next-month href (query-param nav). */
  nextHref: string;
  /** "Today" href — jumps back to the current month. */
  todayHref: string;
  /** ISO date of today, for highlighting. */
  todayIso: string;
  /**
   * Optional cell-link builder. When provided, day cells that have events
   * become Links to `cellHref(iso)` (e.g. /order?date=ISO). When omitted the
   * calendar is read-only (chef view default).
   */
  cellHref?: (iso: string) => string;
}

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

export function ForecastCalendar({
  year,
  month,
  monthLabel,
  eventsByDate,
  legend,
  eventKind,
  prevHref,
  nextHref,
  todayHref,
  todayIso,
  cellHref,
}: Props) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const chipFor = (e: ForecastCalendarEvent): string => {
    const key = eventKind(e);
    return legend.find((l) => l.key === key)?.chipClass ?? "bg-farm-muted/15 text-farm-dark";
  };

  const cells: Array<{ key: string; date: string | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ key: `pad-${i}`, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key: iso, date: iso });
  }

  const isCurrentMonthVisible = todayIso.startsWith(
    `${year}-${String(month + 1).padStart(2, "0")}`,
  );

  return (
    <div className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden">
      {/* Month header with prev/next + Today shortcut */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-farm-dark/5 bg-farm-cream/40">
        <Link
          href={prevHref}
          scroll={false}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-farm-muted hover:text-farm-dark"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="text-center">
          <p className="font-display text-lg text-farm-dark leading-none">{monthLabel}</p>
          {!isCurrentMonthVisible && (
            <Link
              href={todayHref}
              scroll={false}
              className="text-[10px] tracking-[0.18em] uppercase text-farm-green hover:underline mt-1 inline-block"
            >
              Today
            </Link>
          )}
        </div>
        <Link
          href={nextHref}
          scroll={false}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-farm-muted hover:text-farm-dark"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-farm-dark/5">
        {DAY_HEADERS.map((label, i) => (
          <div
            key={i}
            className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold text-center py-2"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          if (!cell.date) {
            return (
              <div
                key={cell.key}
                className="min-h-[72px] border-r border-b border-farm-dark/5 last:border-r-0"
              />
            );
          }
          const iso = cell.date;
          const dayNum = parseInt(iso.slice(8, 10));
          const dayEvents = eventsByDate[iso] ?? [];
          const isToday = iso === todayIso;
          const base =
            "min-h-[72px] border-r border-b border-farm-dark/5 last:border-r-0 p-1.5 flex flex-col gap-1";

          const inner = (
            <>
              <span
                className={`text-xs leading-none ${
                  isToday ? "font-bold text-farm-green" : "text-farm-dark/70"
                }`}
              >
                {dayNum}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <span
                    key={i}
                    className={`block px-1 py-0.5 rounded text-[9px] leading-tight truncate ${chipFor(e)}`}
                    title={e.label}
                  >
                    {e.name}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[9px] text-farm-muted leading-none pl-1">
                    +{dayEvents.length - 3}
                  </span>
                )}
              </div>
            </>
          );

          const cellClass = `${base} ${
            isToday ? "bg-farm-cream/40 ring-1 ring-inset ring-farm-green/30" : ""
          }`;

          if (cellHref && dayEvents.length > 0) {
            return (
              <Link
                key={cell.key}
                href={cellHref(iso)}
                className={`${cellClass} hover:bg-farm-cream/40 transition-colors`}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div key={cell.key} className={cellClass}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-farm-dark/5 bg-farm-cream/30 flex flex-wrap gap-x-3 gap-y-2">
        {legend.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${l.chipClass}`} />
            <span className="text-[10px] text-farm-muted uppercase tracking-wider">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shared legend + classifier for forecast events, used by both admin and chef
 * calendars so the palette stays consistent. Field crops read warm
 * (orange/green for harvest start/end), microgreens read cool (blue for sow,
 * green/amber/red for the harvest window) — matching the microgreens
 * CalendarView and the orders calendar token families.
 */
export const FORECAST_LEGEND: ForecastLegendItem[] = [
  { key: "field-harvest-start", label: "Field harvest starts", chipClass: "bg-pf-master-orange/20 text-pf-master-orange" },
  { key: "field-harvest-end", label: "Field harvest ends", chipClass: "bg-amber-400/20 text-amber-800" },
  { key: "mg-sow", label: "Microgreen sown", chipClass: "bg-blue-500/15 text-blue-800" },
  { key: "mg-harvest-open", label: "MG harvest opens", chipClass: "bg-emerald-300/25 text-emerald-900" },
  { key: "mg-harvest-ideal", label: "MG harvest ideal", chipClass: "bg-farm-green/20 text-farm-green" },
  { key: "mg-harvest-close", label: "MG harvest closes", chipClass: "bg-red-300/25 text-red-800" },
];

/** Maps a ForecastCalendarEvent to its FORECAST_LEGEND key. */
export function forecastEventKind(e: ForecastCalendarEvent): string {
  if (e.source === "field") {
    return e.type === "harvest-start" ? "field-harvest-start" : "field-harvest-end";
  }
  switch (e.type) {
    case "sow":
      return "mg-sow";
    case "harvest-open":
      return "mg-harvest-open";
    case "harvest-ideal":
      return "mg-harvest-ideal";
    case "harvest-close":
      return "mg-harvest-close";
    default:
      return "mg-harvest-ideal";
  }
}
