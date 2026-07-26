import Link from "next/link";
import { CheckSquare, AlertCircle } from "lucide-react";
import type { FarmTask } from "@/types/database";
import { todayPacific } from "@/lib/utils";
import {
  TASK_TYPE_ICONS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from "@/lib/tasks/constants";

interface Props {
  tasks: FarmTask[];
  itemNames?: Record<string, string>;
  cropNames?: Record<string, string>;
  /** Show up to this many before "+ N more". */
  maxItems?: number;
}

/**
 * Compact "Today" task card for the admin dashboard.
 * Mirrors the WeatherWidget visual weight — small, glanceable.
 */
export function TodayWidget({
  tasks,
  itemNames = {},
  cropNames = {},
  maxItems = 6,
}: Props) {
  const visible = tasks.slice(0, maxItems);
  const overflow = Math.max(0, tasks.length - visible.length);
  const today = todayPacific();
  const overdueCount = tasks.filter((t) => t.due_date < today).length;

  return (
    <Link
      href="/admin/tasks"
      className="block bg-white rounded-2xl border border-pf-master-gold/15 shadow-sm p-4 hover:border-pf-master-gold/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold font-medium inline-flex items-center gap-1.5"
          style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
        >
          <CheckSquare className="w-3 h-3" /> Today
        </p>
        {overdueCount > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded badge-red inline-flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {overdueCount} overdue
          </span>
        ) : (
          <span className="text-[10px] text-farm-muted">{tasks.length} open</span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="py-3 text-center">
          <p className="text-sm text-farm-muted">Nothing due today. Nice.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((t) => {
            const subtitle =
              (t.microgreen_crop_id && cropNames[t.microgreen_crop_id]) ||
              (t.item_id && itemNames[t.item_id]) ||
              null;
            return (
              <li key={t.id} className="flex items-start gap-2 text-sm leading-snug">
                <span className="flex-shrink-0" aria-hidden>
                  {TASK_TYPE_ICONS[t.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-farm-dark truncate">{t.title}</p>
                  {subtitle && (
                    <p className="text-[10px] text-farm-muted truncate">{subtitle}</p>
                  )}
                </div>
                {t.priority !== 2 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority]} flex-shrink-0`}
                  >
                    {PRIORITY_LABELS[t.priority]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {overflow > 0 && (
        <p className="text-[11px] text-farm-muted mt-2 text-center border-t border-pf-master-gold/10 pt-2">
          + {overflow} more — view all
        </p>
      )}
    </Link>
  );
}
