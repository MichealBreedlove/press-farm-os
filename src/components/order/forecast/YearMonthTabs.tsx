"use client";

import { useEffect, useRef } from "react";
import type { MonthDensity } from "@/lib/forecasting/types";

interface Props {
  densities: MonthDensity[]; // length 12
  selectedMonth: number;     // 1..12
  /** Today's month (1..12) when viewing the current year, -1 otherwise. */
  currentMonth: number;
  onSelect: (month: number) => void;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dotsFor(count: number): string {
  if (count <= 0) return "";
  if (count <= 2) return "●●";
  if (count <= 4) return "●●●";
  return "●●●●●";
}

function tabClasses(d: MonthDensity, isSelected: boolean, isCurrent: boolean): string {
  const base = "min-w-[58px] min-h-[44px] py-1.5 px-2 rounded-md text-center transition-colors";
  if (isSelected) {
    return `${base} bg-farm-green text-white font-semibold`;
  }
  if (isCurrent) {
    return `${base} border border-farm-green text-farm-green`;
  }
  switch (d.zone) {
    case "past":
      return `${base} bg-farm-cream text-pf-master-gold`;
    case "concrete":
      return `${base} bg-farm-cream text-farm-green`;
    case "seasonal":
      return `${base} bg-farm-cream/60 text-pf-master-gold italic`;
    case "empty":
    default:
      return `${base} text-farm-muted`;
  }
}

export function YearMonthTabs({ densities, selectedMonth, currentMonth, onSelect }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the current month into view on mount.
  useEffect(() => {
    if (currentMonth < 1 || currentMonth > 12) return;
    const el = stripRef.current?.querySelector<HTMLButtonElement>(
      `button[data-month="${currentMonth}"]`,
    );
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
  }, [currentMonth]);

  return (
    <div
      ref={stripRef}
      className="flex gap-1.5 overflow-x-auto px-4 pb-2"
      role="tablist"
      aria-label="Months"
    >
      {densities.map((d) => {
        const isSelected = d.month === selectedMonth;
        const isCurrent = d.month === currentMonth && !isSelected;
        return (
          <button
            key={d.month}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-month={d.month}
            onClick={() => onSelect(d.month)}
            className={tabClasses(d, isSelected, isCurrent)}
          >
            <div className="text-[11px] leading-tight">{MONTH_LABELS[d.month - 1]}</div>
            <div className="text-[10px] leading-tight mt-0.5" aria-hidden="true">
              {dotsFor(d.count)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
