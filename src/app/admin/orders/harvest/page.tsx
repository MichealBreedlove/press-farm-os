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
 * Groups by category, sorted alphabetically within each category.
 * Print-friendly layout.
 */
export default async function HarvestListPage({ searchParams }: HarvestPageProps) {
  const { date } = await searchParams;
  const supabase = await createClient();

  // Default to today if no date provided
  const today = new Date().toISOString().split("T")[0];
  const activeDate = date ?? today;

  // Fetch all orders for this date with item details
  const { data: ordersRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, status,
      restaurant:restaurants(id, name),
      order_items(
        quantity_requested, quantity_fulfilled, is_shorted,
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

  // Aggregate items across both restaurants
  const itemMap = new Map<string, HarvestRow>();

  function addItems(order: any, isPress: boolean) {
    for (const oi of order?.order_items ?? []) {
      const item = oi.availability_item?.item;
      if (!item) continue;

      // Use fulfilled qty if shorted, otherwise requested
      const qty = oi.is_shorted
        ? (oi.quantity_fulfilled ?? 0)
        : (oi.quantity_requested ?? 0);

      const existing = itemMap.get(item.id);
      if (existing) {
        if (isPress) {
          existing.pressQty = (existing.pressQty ?? 0) + qty;
        } else {
          existing.understudyQty = (existing.understudyQty ?? 0) + qty;
        }
        existing.total += qty;
      } else {
        itemMap.set(item.id, {
          itemId: item.id,
          name: item.name,
          category: item.category as ItemCategory,
          unit: item.unit_type as UnitType,
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
      <header className="page-header print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white -ml-2"
            aria-label="Back to orders"
          >
            ←
          </Link>
          <div className="flex-1">
            <h1 className="page-title">Harvest List</h1>
            <p className="text-sm text-white/60">{formatDeliveryDate(activeDate)} · {totalItems} items</p>
          </div>
          <PrintButton />
        </div>
      </header>

      {/* Print-only header */}
      <div className="hidden print:block px-4 py-4">
        <h1 className="text-xl font-bold">HARVEST LIST — {formatDeliveryDate(activeDate)}</h1>
        <p className="text-sm text-gray-600">{totalItems} items</p>
      </div>

      {/* Container summary */}
      {containerList.length > 0 && (
        <div className="px-4 pt-4 print:pt-2">
          <div className="card p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
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
          <p className="text-center text-gray-400 text-sm py-8">
            No orders have been submitted for {formatDeliveryDate(activeDate)}.
          </p>
        )}

        {sortedCategories.map((category) => {
          const rows = byCategory[category];
          return (
            <div key={category}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-2">
                {CATEGORY_LABELS[category as ItemCategory] ?? category}
              </h2>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-xs text-gray-400 font-medium mb-1 px-1">
                <span>Item</span>
                <span className="w-10 text-right">Unit</span>
                <span className="w-14 text-right">Press</span>
                <span className="w-14 text-right">Und.</span>
                <span className="w-14 text-right font-semibold">Total</span>
              </div>

              <div className="space-y-0.5">
                {rows.map((row) => (
                  <div
                    key={row.itemId}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center py-2 px-1 rounded-lg odd:bg-gray-50 print:odd:bg-gray-100"
                  >
                    <span className="text-sm text-gray-900 truncate">{row.name}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {UNIT_LABELS[row.unit] ?? row.unit}
                    </span>
                    <span className="text-sm text-gray-600 w-14 text-right tabular-nums">
                      {row.pressQty != null ? formatQty(row.pressQty) : "—"}
                    </span>
                    <span className="text-sm text-gray-600 w-14 text-right tabular-nums">
                      {row.understudyQty != null ? formatQty(row.understudyQty) : "—"}
                    </span>
                    <span className="text-sm font-bold text-gray-900 w-14 text-right tabular-nums">
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
