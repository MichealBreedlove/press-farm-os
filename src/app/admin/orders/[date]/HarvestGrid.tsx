import { formatQty, cn } from "@/lib/utils";
import { laneStyle } from "@/lib/lanes";
import { CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import {
  harvestRowKey,
  isRowResolved,
  type HarvestGridRow,
  type HarvestGridCategory,
  type HarvestGridContainer,
} from "@/lib/harvest";

export type { HarvestGridRow, HarvestGridCategory, HarvestGridContainer };

/** Display-string overrides so /harvest can render the grid in Spanish. */
export interface HarvestGridLabels {
  containersNeeded: string;
  item: string;
  container: string;
  total: string;
  /** category key → heading (falls back to English CATEGORY_LABELS). */
  categoryLabels: Record<string, string>;
}

/**
 * Short, harvester-friendly column code for a restaurant.
 * Two letters keep the table readable on iPhone during pick.
 */
function shortCode(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("under")) return "US";
  if (lower.includes("bar")) return "PB";
  if (lower.includes("event")) return "EV";
  if (lower.includes("press")) return "PR";
  return name.slice(0, 2).toUpperCase();
}

/**
 * HarvestGrid — the combined cross-restaurant pick list for a delivery date.
 *
 * One row per (crop, container) so different units of the same crop (LG vs SM
 * mint, etc.) stay separate — that's what the harvester needs while picking.
 * Per-restaurant quantities render as dynamic columns. This is the
 * print-optimized artifact: it stays visible when the order page is printed
 * while the interactive per-restaurant workflow below is hidden.
 */
export function HarvestGrid({
  restaurants,
  categories,
  containers,
  labels,
  onToggleRow,
  busyRowKey,
}: {
  restaurants: { id: string; name: string }[];
  categories: HarvestGridCategory[];
  containers: HarvestGridContainer[];
  /** Optional display-string overrides (Spanish on /harvest). */
  labels?: HarvestGridLabels;
  /**
   * When set (from a client component — the /harvest portal), each row
   * becomes a tap target that toggles its harvested state. The admin page
   * omits it and keeps the read-only print-friendly grid.
   */
  onToggleRow?: (row: HarvestGridRow, next: boolean) => void;
  /** Row key (harvestRowKey) currently saving — dims + disables that row. */
  busyRowKey?: string | null;
}) {
  const t: HarvestGridLabels = labels ?? {
    containersNeeded: "Containers Needed",
    item: "Item",
    container: "Cont.",
    total: "Tot",
    categoryLabels: CATEGORY_LABELS,
  };
  // Dynamic grid template: Item | Container | (per-restaurant cols) | Total
  const gridTemplate = `minmax(9rem,1fr) auto ${"auto ".repeat(restaurants.length)}auto`.trim();

  return (
    <section className="space-y-4">
      {/* Container summary */}
      {containers.length > 0 && (
        <div className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted mb-3">
            {t.containersNeeded}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {containers.map(({ unit, label, count, icon }) => (
              <div key={unit} className="flex items-center gap-2 bg-farm-green-light rounded-lg px-3 py-2">
                <span className="text-lg">{icon}</span>
                <div>
                  <p className="text-lg font-bold text-farm-green leading-tight">{count}</p>
                  <p className="text-[10px] text-farm-green/70 uppercase tracking-wide">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {categories.map(({ key, rows }) => (
        <div key={key}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted border-b border-farm-dark/10 pb-1 mb-2">
            {t.categoryLabels[key] ?? CATEGORY_LABELS[key] ?? key}
          </h2>

          {/* Horizontal-scroll wrapper: on a 375px phone the item name +
              per-restaurant columns would crush together (Item was given a
              9rem floor), so scroll the grid instead of truncating. Print
              ignores the overflow and shows the full table on paper. */}
          <div className="overflow-x-auto -mx-1 px-1">
          {/* Column headers — Container column is critical during harvest
              because chefs order different sizes per item (LG sunflowers,
              SM mint, etc.) and the harvester needs to grab the right
              vessel before counting. */}
          <div
            className="grid gap-1 sm:gap-2 text-xs text-farm-muted font-medium mb-1 px-1"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span>{t.item}</span>
            <span className="w-12 sm:w-16 text-center">{t.container}</span>
            {restaurants.map((r) => (
              <span key={r.id} className="w-9 sm:w-12 inline-flex items-center justify-end gap-1" title={r.name}>
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", laneStyle(r.name).dot)} aria-hidden="true" />
                {shortCode(r.name)}
              </span>
            ))}
            <span className="w-10 sm:w-14 text-right font-semibold">{t.total}</span>
          </div>

          <div className="space-y-0.5">
            {rows.map((row) => {
              const rowKey = harvestRowKey(row);
              const done = onToggleRow ? isRowResolved(row) : false;
              const busy = busyRowKey === rowKey;
              const RowTag = onToggleRow ? "button" : "div";
              return (
              <RowTag
                key={rowKey}
                {...(onToggleRow
                  ? {
                      type: "button" as const,
                      onClick: () => onToggleRow(row, !done),
                      disabled: busy,
                      "aria-pressed": done,
                    }
                  : {})}
                className={cn(
                  "grid gap-1 sm:gap-2 items-center py-2 px-1 rounded-lg odd:bg-farm-cream/40 print:odd:bg-farm-cream/60 w-full text-left",
                  onToggleRow && "min-h-[44px] transition-colors active:bg-farm-green/10",
                  done && "bg-farm-green/[0.08] odd:bg-farm-green/[0.08]",
                  busy && "opacity-50",
                )}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <span className={cn("text-sm text-farm-dark truncate flex items-center gap-1.5", done && "text-farm-muted")}>
                  {onToggleRow && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border text-[11px] leading-none flex-shrink-0",
                        done
                          ? "bg-farm-green border-farm-green text-white"
                          : "border-farm-dark/25 bg-white text-transparent",
                      )}
                    >
                      ✓
                    </span>
                  )}
                  <span className={cn("truncate", done && "line-through decoration-farm-muted/60")}>
                  {row.name}
                  {row.varietyKey && (
                    <span className="text-pf-master-blue font-medium">
                      {" "}· {row.varietyKey.split(",").map((v) => v.trim()).filter(Boolean).join(", ")}
                    </span>
                  )}
                  {row.colorKey && (
                    <span className="text-pf-master-violet font-medium">
                      {" "}· {row.colorKey.split(",").map((c) => c.trim()).filter(Boolean).join(", ")}
                    </span>
                  )}
                  </span>
                </span>
                <span className="w-12 sm:w-16 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-farm-green/15 text-farm-green tabular-nums">
                    {(UNIT_LABELS[row.unit] ?? row.unit).toString().toUpperCase()}
                  </span>
                </span>
                {restaurants.map((r) => {
                  const q = row.qtyByRestaurant[r.id];
                  return (
                    <span
                      key={r.id}
                      className="text-sm text-farm-muted/90 w-9 sm:w-12 text-right tabular-nums"
                    >
                      {q != null && q > 0 ? formatQty(q) : "—"}
                    </span>
                  );
                })}
                <span className="text-sm font-bold text-farm-dark w-10 sm:w-14 text-right tabular-nums">
                  {formatQty(row.total)}
                </span>
              </RowTag>
              );
            })}
          </div>
          </div>
        </div>
      ))}
    </section>
  );
}
