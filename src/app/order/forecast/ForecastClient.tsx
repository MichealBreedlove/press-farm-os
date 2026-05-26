"use client";

import { useState, useMemo } from "react";
import { YearMonthTabs } from "@/components/order/forecast/YearMonthTabs";
import { WeekStrip, type WeekInfo } from "@/components/order/forecast/WeekStrip";
import { DetailDrawer } from "@/components/order/forecast/DetailDrawer";
import type {
  WeekBucket,
  ForecastCalendarEvent,
  SeasonalItemRow,
} from "@/lib/forecasting/types";
import { monthDensity, isoWeekStart } from "@/lib/forecasting/yearView";

interface Props {
  initialYear: number;
  currentYear: number;
  currentMonth: number;
  yearOptions: number[];
  data: {
    past: WeekBucket[];
    concrete: ForecastCalendarEvent[];
    seasonal: SeasonalItemRow[];
  };
}

function shortDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

export function ForecastClient({
  initialYear,
  currentYear,
  currentMonth,
  yearOptions,
  data,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(currentMonth);
  const [weekStart, setWeekStart] = useState<string | null>(null);

  const densities = useMemo(() => monthDensity(year, data), [year, data]);

  const selectedDensity = densities[month - 1]!;
  const zone = selectedDensity.zone;

  // Weeks for the selected month, derived from past + concrete data.
  // We only build a week strip for past/concrete zones — seasonal stays
  // at month-level granularity.
  const weeksForMonth: WeekInfo[] = useMemo(() => {
    if (zone === "seasonal" || zone === "empty") return [];

    // Map<weekStartIso, Set<lowercased name>> — drives the count chip.
    const namesByWeek = new Map<string, Set<string>>();

    function bump(weekStartIso: string, name: string) {
      const d = new Date(weekStartIso + "T00:00:00Z");
      if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month) return;
      let s = namesByWeek.get(weekStartIso);
      if (!s) { s = new Set(); namesByWeek.set(weekStartIso, s); }
      s.add(name.trim().toLowerCase());
    }

    // Past actuals: each week's items
    for (const w of data.past) {
      for (const it of w.items) bump(w.weekStart, it.name);
    }
    // Concrete events: bucket by their ISO week
    for (const ev of data.concrete) {
      bump(isoWeekStart(ev.date), ev.name);
    }

    return Array.from(namesByWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ws, names], i) => ({
        weekStart: ws,
        label: `Wk ${i + 1}`,
        shortDate: shortDate(ws),
        count: names.size,
      }));
  }, [zone, data.past, data.concrete, year, month]);

  // Auto-select first week when month changes if the previously-selected
  // week isn't in the current month's strip.
  const effectiveWeekStart =
    zone === "past" || zone === "concrete"
      ? (weekStart && weeksForMonth.some((w) => w.weekStart === weekStart)
          ? weekStart
          : weeksForMonth[0]?.weekStart ?? null)
      : null;

  // Past week data for drawer
  const pastWeek = effectiveWeekStart
    ? data.past.find((w) => w.weekStart === effectiveWeekStart) ?? null
    : null;

  // Concrete events that land in the selected week
  const concreteForWeek = useMemo(() => {
    if (!effectiveWeekStart) return [];
    const weekEndDate = new Date(effectiveWeekStart + "T00:00:00Z");
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
    const weekEndIso = weekEndDate.toISOString().slice(0, 10);
    return data.concrete.filter(
      (ev) => ev.date >= effectiveWeekStart && ev.date <= weekEndIso,
    );
  }, [effectiveWeekStart, data.concrete]);

  function selectMonth(m: number) {
    setMonth(m);
    setWeekStart(null);
  }

  function shiftYear(delta: number) {
    const next = year + delta;
    if (!yearOptions.includes(next)) return;
    setYear(next);
    setWeekStart(null);
  }

  return (
    <div className="pb-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => shiftYear(-1)}
          disabled={!yearOptions.includes(year - 1)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-2xl text-farm-muted disabled:opacity-30"
          aria-label="Previous year"
        >
          ‹
        </button>
        <div
          className="text-3xl text-farm-dark"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {year}
        </div>
        <button
          type="button"
          onClick={() => shiftYear(1)}
          disabled={!yearOptions.includes(year + 1)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-2xl text-farm-muted disabled:opacity-30"
          aria-label="Next year"
        >
          ›
        </button>
      </div>

      <YearMonthTabs
        densities={densities}
        selectedMonth={month}
        currentMonth={year === currentYear ? currentMonth : -1}
        onSelect={selectMonth}
      />

      {(zone === "past" || zone === "concrete") && (
        <WeekStrip
          weeks={weeksForMonth}
          selectedWeekStart={effectiveWeekStart}
          onSelect={setWeekStart}
        />
      )}

      <DetailDrawer
        zone={zone}
        selectedMonth={month}
        selectedWeekStart={effectiveWeekStart}
        pastWeek={pastWeek}
        concreteEvents={concreteForWeek}
        seasonalItems={data.seasonal}
      />
    </div>
  );
}
