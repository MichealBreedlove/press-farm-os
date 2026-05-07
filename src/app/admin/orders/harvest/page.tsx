import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate, formatQty } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ORDER, UNIT_LABELS } from "@/lib/constants";
import { PrintButton } from "./PrintButton";
import Link from "next/link";
import type { ItemCategory, UnitType } from "@/types";

interface HarvestPageProps {
  searchParams: Promise<{ date?: string }>;
}

interface HarvestRow {
  itemId: string;
  name: string;
  category: ItemCategory;
  unit: UnitType;
  pressQty: number | null;
  understudyQty: number | null;
  total: number;
}

/**
 * /admin/orders/harvest — Combined harvest list for both restaurants (server component)
 *
 * URL param: ?date=YYYY-MM-DD
 * Groups by (item, container), sorted alphabetically within each category.
 * If Press orders 2 LG mint and Understudy orders 1 SM mint, they appear as
 * two separate rows so the harvester knows which container goes where.
 * Print-friendly layout.
 */
export default async function HarvestListPage({ searchParams }: HarvestPageProps) {
  const { date } = await searchParams;
  const supabase = await createClient();

  // Default to today if no date provided
  const today = new Date().toISOString().split("T")[0];
  const activeDate = date ?? today;

  // Fetch all orders for this date with item details. Pull unit_type
  // from order_items itself (added in migration 027) so multi-unit
  // items keep separate rows per container instead of getting merged
  // under whatever the catalog's first declared unit is.
  const { data: ordersRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, status,
      restaurant:restaurants(id, name),
      order_items(
        quantity_requested, quantity_fulfilled, is_shorted, unit_type, size_label,
        availability_item:availability_items(
          item:items(id, name, category, unit_type)
        )
      )
    `)
    .eq("delivery_date", activeDate);

  const orders: any[] = ordersRaw ?? [];

  // Determine which restaurant is "Press" and which is "Understudy"
  // We match by name (case-insensitive contains)
  const pressOrder = orders.find((o) =>
    o.restaurant?.name?.toLowerCase().includes("press")
  );
  const understudyOrder = orders.find((o) =>
    o.restaurant?.name?.toLowerCase().includes("understudy")
  );

  // Aggregate items across both restaurants. Group key is (item_id, unit)
  // so different containers of the same crop become separate harvest rows
  // — which is what the harvester needs while picking.
  const itemMap = new Map<string, HarvestRow>();

  function addItems(order: any, isPress: boolean) {
    for (const oi of order?.order_items ?? []) {
      const item = oi.availability_item?.item;
      if (!item) continue;

      // Use fulfilled qty if shorted, otherwise requested
      const qty = oi.is_shorted
        ? (oi.quantity_fulfilled ?? 0)
        : (oi.quantity_requested ?? 0);
      if (qty <= 0) continue;

      // Per-line unit_type (stored on order_items since migration 027).
      // Fall back to the catalog item's first declared unit for older
      // rows that haven't been backfilled. Lower-case so display + key
      // are consistent regardless of how it was stored.
      const lineUnit = (oi.unit_type ?? "").trim().toLowerCase();
      const fallbackUnit = String(item.unit_type ?? "")
        .split(",").map((u: string) => u.trim()).filter(Boolean)[0] ?? "ea";
      const unit = (lineUnit || fallbackUnit) as UnitType;

      const groupKey = `${item.id}|${unit}`;
      const existing = itemMap.get(groupKey);
      if (existing) {
        if (isPress) {
          existing.pressQty = (existing.pressQty ?? 0) + qty;
        } else {
          existing.understudyQty = (existing.understudyQty ?? 0) + qty;
        }
        existing.total += qty;
      } else {
        itemMap.set(groupKey, {
          itemId: item.id,
          name: item.name,
          category: item.category as ItemCategory,
          unit,
          pressQty: isPress ? qty : null,
          understudyQty: isPress ? null : qty,
          total: qty,
        });
      }
    }
  }

  addItems(pressOrder, true);
  addItems(understudyOrder, false);

  // For any order that isn't press or understudy specifically, add as press
  for (const order of orders) {
    if (order !== pressOrder && order !== understudyOrder) {
      addItems(order, true);
    }
  }

  // Group by category, sort within each
  const byCategory: Record<string, HarvestRow[]> = {};
  for (const row of Array.from(itemMap.values())) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push(row);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  const sortedCategories = CATEGORY_ORDER.filter((c) => byCategory[c]);
  const totalItems = itemMap.size;

  // ── Container calculator ──
  // Count how many of each container type are needed based on unit_type totals
  const containerCounts: Record<string, { label: string; count: number; icon: string }> = {};
  const CONTAINER_MAP: Record<string, { label: string; icon: string }> = {
    lg: { label: "Large To-Go", icon: "📦" },
    sm: { label: "Small To-Go", icon: "📦" },
    lbs: { label: "Green Bin", icon: "🟩" },
    bx: { label: "Box", icon: "📦" },
    bu: { label: "Bunch", icon: "🌿" },
    qt: { label: "Quart", icon: "🥤" },
    pt: { label: "Pint", icon: "🥤" },
    cs: { label: "Case", icon: "📦" },
    kit: { label: "Kit", icon: "🧰" },
  };

  for (const row of Array.from(itemMap.values())) {
    const unit = row.unit;
    if (unit === "ea") continue; // Individual items don't need containers
    const container = CONTAINER_MAP[unit];
    if (!container) continue;
    if (!containerCounts[unit]) {
      containerCounts[unit] = { label: container.label, count: 0, icon: container.icon };
    }
    containerCounts[unit].count += row.total;
  }

  const containerList = Object.entries(containerCounts)
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  return (
    <main>
      <header className="page-header no-wordmark print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white -ml-2"
            aria-label="Back to orders"
          >
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="page-title">Harvest List</h1>
            <p className="text-sm text-white/60">{formatDeliveryDate(activeDate)} · {totalItems} items</p>
          </div>
          <PrintButton />
        </div>
      </header>

      {/* Print-only header */}
      <div className="hidden print:block px-4 py-4">
        <h1 className="text-xl font-bold">HARVEST LIST — {formatDeliveryDate(activeDate)}</h1>
        <p className="text-sm text-farm-muted/90">{totalItems} items</p>
      </div>

      {/* Container summary */}
      {containerList.length > 0 && (
        <div className="px-4 pt-4 print:pt-2">
          <div className="card p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted mb-3">
              Containers Needed
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {containerList.map(([unit, { label, count, icon }]) => (
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
        </div>
      )}

      <div className="px-4 py-4 space-y-6 print:py-2 print:space-y-4">
        {totalItems === 0 && (
          <p className="text-center text-farm-muted text-sm py-8">
            No orders have been submitted for {formatDeliveryDate(activeDate)}.
          </p>
        )}

        {sortedCategories.map((category) => {
          const rows = byCategory[category];
          return (
            <div key={category}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted border-b border-farm-dark/10 pb-1 mb-2">
                {CATEGORY_LABELS[category as ItemCategory] ?? category}
              </h2>

              {/* Column headers — Container column is critical during
                  harvest because chefs often order different sizes per
                  item (LG sunflowers, SM mint, etc.) and the harvester
                  needs to grab the right vessel before counting. */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 sm:gap-2 text-xs text-farm-muted font-medium mb-1 px-1">
                <span>Item</span>
                <span className="w-12 sm:w-16 text-center">Cont.</span>
                <span className="w-10 sm:w-14 text-right">P</span>
                <span className="w-10 sm:w-14 text-right">U</span>
                <span className="w-10 sm:w-14 text-right font-semibold">Tot</span>
              </div>

              <div className="space-y-0.5">
                {rows.map((row) => (
                  <div
                    key={`${row.itemId}-${row.unit}`}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 sm:gap-2 items-center py-2 px-1 rounded-lg odd:bg-farm-cream/40 print:odd:bg-farm-cream/60"
                  >
                    <span className="text-sm text-farm-dark truncate">{row.name}</span>
                    <span className="w-12 sm:w-16 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-farm-green/15 text-farm-green tabular-nums">
                        {(UNIT_LABELS[row.unit] ?? row.unit).toString().toUpperCase()}
                      </span>
                    </span>
                    <span className="text-sm text-farm-muted/90 w-10 sm:w-14 text-right tabular-nums">
                      {row.pressQty != null ? formatQty(row.pressQty) : "—"}
                    </span>
                    <span className="text-sm text-farm-muted/90 w-10 sm:w-14 text-right tabular-nums">
                      {row.understudyQty != null ? formatQty(row.understudyQty) : "—"}
                    </span>
                    <span className="text-sm font-bold text-farm-dark w-10 sm:w-14 text-right tabular-nums">
                      {formatQty(row.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
