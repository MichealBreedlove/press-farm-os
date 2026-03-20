import type { HarvestListItem } from "@/types";
import { CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatQty } from "@/lib/utils";

interface HarvestListProps {
  date: string;
  items: HarvestListItem[];
}

/**
 * HarvestList — combined harvest view for both Press + Understudy.
 *
 * Grouped by category. Shows:
 *   Item | Unit | Press Qty | Understudy Qty | Total
 *
 * Designed to be readable on iPhone at arm's length during harvest.
 * Print-friendly (full-width table, no hover states).
 *
 * TODO: Add print styles
 */
export function HarvestList({ date, items }: HarvestListProps) {
  // Group by category
  const grouped = items.reduce<Record<string, HarvestListItem[]>>((acc, item) => {
    const cat = item.item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="font-mono text-sm">
      <h2 className="font-bold text-base mb-4">HARVEST LIST — {date}</h2>
      {Object.entries(grouped).map(([category, categoryItems]) => (
        <div key={category} className="mb-6">
          <h3 className="font-bold uppercase text-xs tracking-wider text-gray-500 mb-2 border-b border-gray-200 pb-1">
            {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
          </h3>
          <div className="space-y-1">
            {categoryItems.map((hi) => (
              <div
                key={hi.item.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center py-1"
              >
                <span className="truncate">{hi.item.name}</span>
                <span className="text-gray-400 w-8 text-right">{UNIT_LABELS[hi.unit]}</span>
                <span className="text-right w-16">{hi.press_qty != null ? formatQty(hi.press_qty) : "—"}</span>
                <span className="text-right w-16">{hi.understudy_qty != null ? formatQty(hi.understudy_qty) : "—"}</span>
                <span className="font-bold text-right w-16">{formatQty(hi.total_qty)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
