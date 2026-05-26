"use client";

import type { WeekBucket } from "@/lib/forecasting/types";

interface Props {
  bucket: WeekBucket | null;
}

function formatWeekHeading(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatQty(q: number, unit: string): string {
  const rounded = Math.round(q * 100) / 100;
  return `${rounded} ${unit}`;
}

/**
 * Past-zone drawer content: single ungrouped list of what was delivered
 * to this chef's restaurant that week.
 */
export function PastWeekDetail({ bucket }: Props) {
  if (!bucket || bucket.items.length === 0) {
    return (
      <p className="text-sm text-farm-muted py-6 text-center">
        No deliveries this week.
      </p>
    );
  }
  return (
    <div>
      <h3 className="text-[11px] tracking-[0.18em] uppercase text-pf-master-gold mb-3">
        Delivered week of {formatWeekHeading(bucket.weekStart)}
      </h3>
      <ul className="divide-y divide-pf-master-gold/15">
        {bucket.items.map((it) => (
          <li key={it.id} className="py-2 flex items-center justify-between gap-2">
            <span className="text-sm text-farm-dark">{it.name}</span>
            <span className="text-xs text-farm-muted whitespace-nowrap">
              {formatQty(it.quantity, it.unit)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
