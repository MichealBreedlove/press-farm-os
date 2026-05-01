"use client";

import Link from "next/link";

interface DayActivity {
  date: string;
  isDeliveryDate: boolean;
  orderingOpen: boolean;
  orderCount: number;
  deliveryCount: number;
  deliveryTotal: number;
  availabilityPublished: boolean;
  notified: boolean;
  isToday: boolean;
}

interface Props {
  year: number;
  month: number; // 0-indexed
  monthLabel: string;
  activity: DayActivity[];
  prevHref: string;
  nextHref: string;
}

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarGrid({ year, month, monthLabel, activity, prevHref, nextHref }: Props) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a quick lookup
  const byDate = new Map(activity.map((a) => [a.date, a]));

  // Pad leading empty cells so day-of-month aligns with weekday columns
  const cells: Array<{ key: string; date: string | null; day?: DayActivity }> = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ key: `pad-${i}`, date: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key: dateStr, date: dateStr, day: byDate.get(dateStr) });
  }

  return (
    <div className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden">
      {/* Month header with prev/next + Today shortcut */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-farm-dark/5 bg-farm-cream/40">
        <Link
          href={prevHref}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-farm-muted hover:text-farm-dark"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="text-center">
          <p className="font-display text-lg text-farm-dark leading-none">{monthLabel}</p>
          {/* "Today" jumps back to the current month — only renders when not
              already viewing it, so it doesn't add visual noise. */}
          {!activity.some((d) => d.isToday) && (
            <Link
              href="/admin/calendar"
              className="text-[10px] tracking-[0.18em] uppercase text-farm-green hover:underline mt-1 inline-block"
            >
              Today
            </Link>
          )}
        </div>
        <Link
          href={nextHref}
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
          <div key={i} className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold text-center py-2">
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="aspect-square border-r border-b border-farm-dark/5 last:border-r-0" />;
          }
          const day = cell.day;
          const dayNum = parseInt(cell.date.slice(8, 10));
          const baseClass = "aspect-square border-r border-b border-farm-dark/5 last:border-r-0 p-1.5 sm:p-2 flex flex-col gap-0.5 transition-colors";

          // Plain day with no activity
          if (!day || (!day.isDeliveryDate && day.orderCount === 0 && day.deliveryCount === 0)) {
            return (
              <div key={cell.key} className={`${baseClass} ${day?.isToday ? "bg-farm-cream/40" : ""}`}>
                <span className={`text-xs ${day?.isToday ? "font-bold text-farm-green" : "text-farm-muted/70"}`}>{dayNum}</span>
              </div>
            );
          }

          // Active day → linkable
          return (
            <Link
              key={cell.key}
              href={`/admin/orders/${cell.date}`}
              className={`${baseClass} hover:bg-farm-cream/40 ${day.isToday ? "bg-farm-cream/40 ring-1 ring-inset ring-farm-green/30" : ""}`}
            >
              <span className={`text-xs ${day.isToday ? "font-bold text-farm-green" : "font-medium text-farm-dark"}`}>{dayNum}</span>

              {/* Activity dots — small but distinct */}
              <div className="flex flex-wrap gap-0.5 mt-auto">
                {day.availabilityPublished && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-farm-green"
                    title="Availability published"
                    aria-label="availability"
                  />
                )}
                {day.orderCount > 0 && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-pf-master-blue"
                    title={`${day.orderCount} order${day.orderCount === 1 ? "" : "s"}`}
                    aria-label="orders"
                  />
                )}
                {day.deliveryCount > 0 && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-pf-master-orange"
                    title={`${day.deliveryCount} deliver${day.deliveryCount === 1 ? "y" : "ies"}`}
                    aria-label="deliveries"
                  />
                )}
                {day.notified && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-pf-master-violet"
                    title="Receiver notified"
                    aria-label="notified"
                  />
                )}
              </div>

              {/* Counts on larger screens */}
              {(day.orderCount > 0 || day.deliveryCount > 0) && (
                <span className="hidden sm:block text-[9px] text-farm-muted leading-none">
                  {day.orderCount > 0 && `${day.orderCount}o`}
                  {day.orderCount > 0 && day.deliveryCount > 0 && " "}
                  {day.deliveryCount > 0 && `${day.deliveryCount}d`}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-farm-dark/5 bg-farm-cream/30 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-farm-green" />
          <span className="text-[10px] text-farm-muted uppercase tracking-wider">Avail.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-pf-master-blue" />
          <span className="text-[10px] text-farm-muted uppercase tracking-wider">Orders</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-pf-master-orange" />
          <span className="text-[10px] text-farm-muted uppercase tracking-wider">Deliveries</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-pf-master-violet" />
          <span className="text-[10px] text-farm-muted uppercase tracking-wider">Notified</span>
        </div>
      </div>
    </div>
  );
}
