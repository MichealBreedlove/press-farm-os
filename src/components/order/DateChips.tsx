import Link from "next/link";
import { formatDateShort } from "@/lib/utils";

interface Props {
  dates: string[];
  activeDate: string;
  /** Delivery dates outside the Thu/Sat/Mon schedule (day_of_week = custom). */
  customDates?: string[];
}

/**
 * Upcoming open delivery dates as tappable chips under the order header, so
 * choosing Saturday instead of Thursday is one obvious tap rather than a
 * buried "different date" link. Server-rendered Links: /order?date=X is the
 * existing switch path, so no client state is needed.
 */
export function DateChips({ dates, activeDate, customDates = [] }: Props) {
  if (dates.length <= 1 && dates[0] === activeDate) return null;
  const custom = new Set(customDates);
  return (
    <div className="px-4 pt-3 -mb-1" role="group" aria-label="Delivery date">
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {dates.map((d) => {
          const active = d === activeDate;
          return (
            <Link
              key={d}
              href={`/order?date=${d}`}
              aria-current={active ? "date" : undefined}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 min-h-[40px] text-sm font-medium transition-colors ${
                active
                  ? "bg-farm-green text-white border-farm-green shadow-sm"
                  : "bg-white text-farm-dark border-farm-dark/10 hover:border-farm-green/40"
              }`}
            >
              {formatDateShort(d)}
              {custom.has(d) && (
                <span className={`text-[9px] tracking-[0.14em] uppercase ${active ? "text-white/80" : "text-pf-master-violet"}`}>
                  off-sched
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
