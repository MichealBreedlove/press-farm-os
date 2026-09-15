/**
 * Shared "what did the chef actually order" core for every item picker.
 *
 * The chef order form and the Events order form both render items with
 * CategorySection/ItemRow and keep quantities under the order-key
 * conventions in lib/order-keys. This module owns the two pure pieces they
 * used to each reimplement: grouping availability into category sections,
 * and flattening the quantity/color/variety/note maps into ordered lines.
 * Pure — tested in tests/lib/order-lines.test.ts.
 */

import { CATEGORY_ORDER } from "@/lib/constants";
import { enumerateOrderKeys } from "@/lib/order-keys";
import { resolveSizes, resolveUnits } from "@/lib/order-availability";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";

export type MenuSection = "regular" | "events" | "press_bar";

/** One (availability row, section) the picker can take quantities for. A
 *  split item contributes two sources: its regular row and an event-portion
 *  clone whose id is prefixed (see EVENT_MENU_KEY_PREFIX). */
export interface PickerSource {
  ai: AvailabilityItemWithItem;
  section: MenuSection;
}

export interface PickerMaps {
  quantities: Record<string, number>;
  itemNotes: Record<string, string>;
  itemColors: Record<string, string[]>;
  itemVarieties: Record<string, string[]>;
}

export interface OrderedLine {
  /** The real availability row id (prefix stripped for event portions). */
  availabilityItemId: string;
  /** The source row as rendered (may carry the prefixed clone id). */
  ai: AvailabilityItemWithItem;
  /** Quantity-state key this line came from. */
  key: string;
  /** Unit the chef picked, or the item's first unit when it has one. */
  unit: string;
  /** Whether the unit came from an explicit multi-unit cell. */
  unitExplicit: boolean;
  size: string | null;
  colors: string[];
  varieties: string[];
  quantity: number;
  section: MenuSection;
  /** Free-text note the chef typed on the item row. */
  itemNote: string;
}

/** Sort each category's items by name, case-insensitively, in CATEGORY_ORDER. */
export function groupByCategory(
  items: AvailabilityItemWithItem[],
): Record<ItemCategory, AvailabilityItemWithItem[]> {
  const out = {} as Record<ItemCategory, AvailabilityItemWithItem[]>;
  for (const cat of CATEGORY_ORDER) out[cat] = [];
  for (const ai of items) {
    const cat = ai.item.category as ItemCategory;
    if (out[cat]) out[cat].push(ai);
  }
  for (const cat of CATEGORY_ORDER) {
    out[cat].sort((a, b) => a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" }));
  }
  return out;
}

/** Every (unit, size) cell the row exposes, with its quantity key. */
export function* enumerateCells(ai: AvailabilityItemWithItem) {
  yield* enumerateOrderKeys(
    ai.id,
    resolveUnits(ai.item, ai.available_units),
    resolveSizes(ai.item, ai.available_sizes),
  );
}

/**
 * Flatten the picker maps into ordered lines (quantity > 0 only), walking
 * every cell of every source so a split item yields two lines and a
 * multi-unit item yields one per unit/size actually ordered.
 */
export function collectOrderedLines(
  sources: PickerSource[],
  maps: PickerMaps,
  realId: (id: string) => string = (id) => id,
): OrderedLine[] {
  const out: OrderedLine[] = [];
  for (const { ai, section } of sources) {
    const itemNote = maps.itemNotes[ai.id] ?? "";
    const firstUnit = String(ai.item.unit_type ?? "").split(",")[0]?.trim() || String(ai.item.unit_type ?? "");
    for (const { key, unit, size } of enumerateCells(ai)) {
      const quantity = maps.quantities[key] ?? 0;
      if (quantity <= 0) continue;
      out.push({
        availabilityItemId: realId(ai.id),
        ai,
        key,
        unit: unit ?? firstUnit,
        unitExplicit: Boolean(unit),
        size: size ?? null,
        colors: maps.itemColors[key] ?? [],
        varieties: maps.itemVarieties[key] ?? [],
        quantity,
        section,
        itemNote,
      });
    }
  }
  return out;
}

export function countOrderedLines(sources: PickerSource[], quantities: Record<string, number>): number {
  let n = 0;
  for (const { ai } of sources) {
    for (const { key } of enumerateCells(ai)) if ((quantities[key] ?? 0) > 0) n++;
  }
  return n;
}
