"use client";

import type {
  ForecastCalendarEvent,
  WeekBucket,
  SeasonalItemRow,
  MonthDensity,
} from "@/lib/forecasting/types";
import { PastWeekDetail } from "./PastWeekDetail";
import { ConcreteWeekDetail } from "./ConcreteWeekDetail";
import { SeasonalMonthDetail } from "./SeasonalMonthDetail";
import { monthSeasonalItems } from "@/lib/forecasting/yearView";

interface Props {
  zone: MonthDensity["zone"];
  selectedMonth: number;
  selectedWeekStart: string | null;
  pastWeek: WeekBucket | null;
  concreteEvents: ForecastCalendarEvent[];
  seasonalItems: SeasonalItemRow[];
}

/**
 * Routes drawer content based on zone + selection state. The page passes the
 * raw three-zone data; this component picks the right child.
 */
export function DetailDrawer({
  zone,
  selectedMonth,
  selectedWeekStart,
  pastWeek,
  concreteEvents,
  seasonalItems,
}: Props) {
  return (
    <div className="bg-white border border-pf-master-gold/30 rounded-lg p-4 mx-4 mt-2 shadow-sm">
      {zone === "past" && <PastWeekDetail bucket={pastWeek} />}

      {zone === "concrete" && (
        <ConcreteWeekDetail
          weekStart={selectedWeekStart ?? ""}
          events={concreteEvents}
        />
      )}

      {(zone === "seasonal" || zone === "empty") && (
        <SeasonalMonthDetail
          month={selectedMonth}
          grouped={monthSeasonalItems(selectedMonth, seasonalItems)}
        />
      )}
    </div>
  );
}
