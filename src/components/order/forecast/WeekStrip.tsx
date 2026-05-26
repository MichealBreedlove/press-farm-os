"use client";

export interface WeekInfo {
  weekStart: string; // ISO Monday
  label: string;     // "Wk 2"
  shortDate: string; // "Jun 9"
  count: number;     // distinct items
}

interface Props {
  weeks: WeekInfo[];
  selectedWeekStart: string | null;
  onSelect: (weekStart: string) => void;
}

function dotsFor(count: number): string {
  if (count <= 0) return "—";
  if (count <= 2) return "●●";
  if (count <= 4) return "●●●";
  return "●●●●";
}

export function WeekStrip({ weeks, selectedWeekStart, onSelect }: Props) {
  if (weeks.length === 0) return null;
  return (
    <div
      className="flex gap-1.5 overflow-x-auto px-4 pb-3"
      role="tablist"
      aria-label="Weeks"
    >
      {weeks.map((w) => {
        const isSelected = w.weekStart === selectedWeekStart;
        const cls = isSelected
          ? "min-w-[64px] min-h-[44px] bg-farm-cream border-2 border-pf-master-gold rounded-md py-2 px-2 text-center font-semibold"
          : "min-w-[64px] min-h-[44px] bg-white border border-pf-master-gold/20 rounded-md py-2 px-2 text-center";
        return (
          <button
            key={w.weekStart}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(w.weekStart)}
            className={cls}
          >
            <div className="text-[10px] text-pf-master-gold uppercase tracking-wider">
              {w.shortDate}
            </div>
            <div className="text-[11px] text-farm-dark mt-0.5">{w.label}</div>
            <div className="text-[12px] text-farm-green leading-none mt-1" aria-hidden="true">
              {dotsFor(w.count)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
