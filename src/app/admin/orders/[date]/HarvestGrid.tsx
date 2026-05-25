import { formatQty } from "@/lib/utils";
import { CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import type { ItemCategory, UnitType } from "@/types";

export interface HarvestGridRow {
  itemId: string;
  name: string;
  unit: UnitType;
  /** restaurantId → qty (for the restaurants that placed orders this date) */
  qtyByRestaurant: Record<string, number>;
  total: number;
}

export interface HarvestGridCategory {
  key: ItemCategory;
  rows: HarvestGridRow[];
}

export interface HarvestGridContainer {
  unit: string;
  label: string;
  count: number;
  icon: string;
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
}: {
  restaurants: { id: string; name: string }[];
  categories: HarvestGridCategory[];
  containers: HarvestGridContainer[];
}) {
  // Dynamic grid template: Item | Container | (per-restaurant cols) | Total
  const gridTemplate = `1fr auto ${"auto ".repeat(restaurants.length)}auto`.trim();

  return (
    <section className="space-y-4">
      {/* Container summary */}
      {containers.length > 0 && (
        <div className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted mb-3">
            Containers Needed
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
            {CATEGORY_LABELS[key] ?? key}
          </h2>

          {/* Column headers — Container column is critical during harvest
              because chefs order different sizes per item (LG sunflowers,
              SM mint, etc.) and the harvester needs to grab the right
              vessel before counting. */}
          <div
            className="grid gap-1 sm:gap-2 text-xs text-farm-muted font-medium mb-1 px-1"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span>Item</span>
            <span className="w-12 sm:w-16 text-center">Cont.</span>
            {restaurants.map((r) => (
              <span key={r.id} className="w-9 sm:w-12 text-right" title={r.name}>
                {shortCode(r.name)}
              </span>
            ))}
            <span className="w-10 sm:w-14 text-right font-semibold">Tot</span>
          </div>

          <div className="space-y-0.5">
            {rows.map((row) => (
              <div
                key={`${row.itemId}-${row.unit}`}
                className="grid gap-1 sm:gap-2 items-center py-2 px-1 rounded-lg odd:bg-farm-cream/40 print:odd:bg-farm-cream/60"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <span className="text-sm text-farm-dark truncate">{row.name}</span>
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
