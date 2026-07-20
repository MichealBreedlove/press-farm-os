import type { ItemCategory, UnitType } from "@/types";
import { CATEGORY_ORDER } from "@/lib/constants";

export interface HarvestGridRow {
  itemId: string;
  name: string;
  unit: UnitType;
  /** Specific color the chef requested (e.g. "Red, Yellow"); null if none. */
  colorKey?: string | null;
  /** Specific variety the chef requested (e.g. "Genovese, Thai"); null if none. */
  varietyKey?: string | null;
  /** restaurantId → qty (for the restaurants that placed orders this date) */
  qtyByRestaurant: Record<string, number>;
  total: number;
  /** order_item ids contributing to this row (when the source rows carry ids). */
  lineIds: string[];
  /** Contributing lines already resolved — picked_at set OR shorted. */
  resolvedLineCount: number;
}

/** Stable identity for a grid row — item × container × color × variety. */
export function harvestRowKey(row: Pick<HarvestGridRow, "itemId" | "unit" | "colorKey" | "varietyKey">): string {
  return `${row.itemId}|${row.unit}|${row.colorKey ?? ""}|${row.varietyKey ?? ""}`;
}

/** A row is "harvested" when every contributing line is picked or shorted. */
export function isRowResolved(row: Pick<HarvestGridRow, "lineIds" | "resolvedLineCount">): boolean {
  return row.lineIds.length > 0 && row.resolvedLineCount >= row.lineIds.length;
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
 * Minimal order shape the harvest roll-up needs — a subset of the
 * orders + order_items + availability_item → item join used by both
 * /admin/orders/[date] and /harvest.
 */
export interface HarvestOrderItem {
  /** order_item id — optional; when present rows collect it into lineIds. */
  id?: string | null;
  quantity_requested: number | null;
  quantity_fulfilled: number | null;
  is_shorted: boolean | null;
  unit_type: string | null;
  color_key?: string | null;
  variety_key?: string | null;
  picked_at?: string | null;
  availability_item?: {
    item?: {
      id: string;
      name: string;
      category?: string | null;
      unit_type?: string | null;
    } | null;
  } | null;
}

export interface HarvestOrder {
  status: string;
  restaurant?: { id: string; name: string } | null;
  order_items?: HarvestOrderItem[] | null;
}

export interface HarvestAggregate {
  /** Restaurants that placed an order, in harvester-friendly column order. */
  restaurantsInPlay: { id: string; name: string }[];
  /** Rows grouped by category (CATEGORY_ORDER), alphabetical within each. */
  categories: HarvestGridCategory[];
  /** Container tallies by unit, largest first. */
  containers: HarvestGridContainer[];
  /** Distinct (item, container, color, variety) rows. */
  itemCount: number;
  /** Every order line across all orders on the date. */
  totalLines: number;
  /** Lines resolved = picked OR shorted. */
  resolvedLines: number;
  /** Orders still in 'submitted' status. */
  submittedOrderCount: number;
}

/** Vessel label + icon per unit code — English display defaults. */
export const CONTAINER_MAP: Record<string, { label: string; icon: string }> = {
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

/**
 * Stable harvester-friendly restaurant ordering
 * (Press → Understudy → Press Bar → Events → others).
 */
export function harvestRestaurantOrder(name: string): number {
  const lower = name.toLowerCase();
  if (lower === "press") return 0;
  if (lower.includes("under")) return 1;
  if (lower.includes("bar")) return 2;
  if (lower.includes("event")) return 3;
  return 100;
}

/**
 * Roll up every order_item across every restaurant into (item, container,
 * color, variety) buckets — the combined cross-restaurant pick list for a
 * delivery date. Pure function extracted from /admin/orders/[date] so the
 * harvester portal (/harvest) renders the exact same list.
 *
 * Different containers/varieties/colors of the same crop stay on separate
 * rows (you pick each one separately); regular + events lines of the same
 * (crop, container, variety, color) sum together.
 */
export function aggregateHarvest(orders: HarvestOrder[]): HarvestAggregate {
  const restaurantsInPlay: { id: string; name: string }[] = [];
  const seenRestaurantIds = new Set<string>();
  for (const o of orders) {
    const r = o.restaurant;
    if (!r?.id || seenRestaurantIds.has(r.id)) continue;
    seenRestaurantIds.add(r.id);
    restaurantsInPlay.push({ id: r.id, name: r.name });
  }
  restaurantsInPlay.sort((a, b) => {
    const oa = harvestRestaurantOrder(a.name);
    const ob = harvestRestaurantOrder(b.name);
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  type AggRow = HarvestGridRow & { category: ItemCategory };
  const itemMap = new Map<string, AggRow>();
  let totalLines = 0;
  let resolvedLines = 0;
  let submittedOrderCount = 0;
  for (const order of orders) {
    if (order.status === "submitted") submittedOrderCount += 1;
    const restaurantId = order.restaurant?.id;
    for (const oi of order.order_items ?? []) {
      const item = oi.availability_item?.item;
      if (!item) continue;
      totalLines += 1;
      // A line is "resolved" if admin either checked it off as picked OR
      // marked it shorted — both close the loop for receiver hand-off.
      if (oi.picked_at || oi.is_shorted) resolvedLines += 1;

      const lineUnit = ((oi.unit_type ?? "").trim().toLowerCase() ||
        (String(item.unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean)[0] ?? "ea")) as UnitType;
      const qty = oi.is_shorted ? Number(oi.quantity_fulfilled ?? 0) : Number(oi.quantity_requested ?? 0);
      if (qty <= 0 || !restaurantId) continue;

      const colorKey = (oi.color_key ?? "").trim();
      const varietyKey = (oi.variety_key ?? "").trim();

      const key = `${item.id}|${lineUnit}|${colorKey}|${varietyKey}`;
      let row = itemMap.get(key);
      if (!row) {
        row = {
          itemId: item.id,
          name: item.name,
          category: (item.category ?? "other") as ItemCategory,
          unit: lineUnit,
          colorKey: colorKey || null,
          varietyKey: varietyKey || null,
          qtyByRestaurant: {},
          total: 0,
          lineIds: [],
          resolvedLineCount: 0,
        };
        itemMap.set(key, row);
      }
      row.qtyByRestaurant[restaurantId] = (row.qtyByRestaurant[restaurantId] ?? 0) + qty;
      row.total += qty;
      if (oi.id) {
        row.lineIds.push(oi.id);
        if (oi.picked_at || oi.is_shorted) row.resolvedLineCount += 1;
      }
    }
  }

  const harvestByCategory: Record<string, HarvestGridRow[]> = {};
  for (const row of itemMap.values()) {
    if (!harvestByCategory[row.category]) harvestByCategory[row.category] = [];
    harvestByCategory[row.category].push(row);
  }
  for (const cat of Object.keys(harvestByCategory)) {
    harvestByCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
  }
  const categories: HarvestGridCategory[] = CATEGORY_ORDER
    .filter((c) => harvestByCategory[c])
    .map((c) => ({ key: c, rows: harvestByCategory[c] }));

  const containerCounts: Record<string, HarvestGridContainer> = {};
  for (const row of itemMap.values()) {
    if (row.unit === "ea") continue;
    const c = CONTAINER_MAP[row.unit];
    if (!c) continue;
    if (!containerCounts[row.unit]) {
      containerCounts[row.unit] = { unit: row.unit, label: c.label, count: 0, icon: c.icon };
    }
    containerCounts[row.unit].count += row.total;
  }
  const containers = Object.values(containerCounts)
    .filter((v) => v.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    restaurantsInPlay,
    categories,
    containers,
    itemCount: itemMap.size,
    totalLines,
    resolvedLines,
    submittedOrderCount,
  };
}
