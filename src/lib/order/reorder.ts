/**
 * Reorder — map a past order's lines onto a NEW delivery date's availability.
 *
 * Availability rows are per (date, restaurant), so a line from last Thursday
 * points at an availability id that doesn't exist on next Tuesday. We match
 * by item id instead, rebuild the quantity key the way OrderForm enumerates
 * keys for the new row, and drop anything the new date doesn't offer.
 * Pure, so it's unit-tested in tests/lib/reorder.test.ts.
 */

import { EVENT_MENU_KEY_PREFIX } from "@/lib/constants";
import { buildOrderKey, enumerateOrderKeys } from "@/lib/order-keys";
import { resolveColors, resolveSizes, resolveUnits, resolveVarieties } from "@/lib/order-availability";

export interface PastOrderLine {
  itemId: string;
  quantity: number;
  unitType: string | null;
  sizeLabel: string | null;
  colorKey: string | null;
  varietyKey: string | null;
  menuSection: string | null;
}

/** The slice of an availability row the mapper needs. */
export interface ReorderTarget {
  id: string;
  status: string;
  available_units: string | null;
  available_sizes: string | null;
  available_colors: string | null;
  available_varieties: string | null;
  item: {
    id: string;
    name: string;
    unit_type: string;
    size?: string | null;
    color?: string | null;
    variety?: string | null;
    is_archived?: boolean | null;
  };
}

export interface ReorderResult {
  quantities: Record<string, number>;
  colors: Record<string, string[]>;
  varieties: Record<string, string[]>;
  eventChecked: Record<string, boolean>;
  splitOpen: Record<string, boolean>;
  /** Names of items on the old order that this date doesn't offer. */
  missing: string[];
  /** Count of lines that landed on the form. */
  placed: number;
}

export function mapReorder(
  lines: Array<PastOrderLine & { itemName: string }>,
  targets: ReorderTarget[],
): ReorderResult {
  const byItem = new Map<string, ReorderTarget>();
  for (const t of targets) {
    if (t.status === "unavailable" || t.item?.is_archived) continue;
    if (!byItem.has(t.item.id)) byItem.set(t.item.id, t);
  }

  const out: ReorderResult = {
    quantities: {},
    colors: {},
    varieties: {},
    eventChecked: {},
    splitOpen: {},
    missing: [],
    placed: 0,
  };

  // Pre-pass mirrors OrderForm's edit hydration: an item with BOTH regular and
  // event lines becomes a split; event-only becomes the whole-item checkmark.
  const itemIdsWithRegular = new Set<string>();
  for (const l of lines) if (l.menuSection !== "events") itemIdsWithRegular.add(l.itemId);

  const seenMissing = new Set<string>();
  for (const l of lines) {
    if (!(l.quantity > 0)) continue;
    const t = byItem.get(l.itemId);
    if (!t) {
      if (!seenMissing.has(l.itemId)) {
        seenMissing.add(l.itemId);
        out.missing.push(l.itemName);
      }
      continue;
    }

    const units = resolveUnits(t.item, t.available_units);
    const sizes = resolveSizes(t.item, t.available_sizes);
    const hasMulti = units.length > 1;
    const valid = new Set<string>();
    for (const { key } of enumerateOrderKeys(t.id, units, sizes)) valid.add(key);

    // Prefer the exact (unit, size) the chef used last time; if that cell no
    // longer exists (unit dropped, size renamed), land on the first cell so
    // the quantity is at least visible and editable rather than lost.
    let key = buildOrderKey(t.id, { unit: l.unitType, size: l.sizeLabel, hasMultiUnits: hasMulti });
    if (!valid.has(key)) {
      const first = valid.values().next().value as string | undefined;
      if (!first) continue;
      key = first;
    }

    if (l.menuSection === "events") {
      if (itemIdsWithRegular.has(l.itemId)) {
        key = `${EVENT_MENU_KEY_PREFIX}${key}`;
        out.splitOpen[t.id] = true;
      } else {
        out.eventChecked[t.id] = true;
      }
    }

    out.quantities[key] = (out.quantities[key] ?? 0) + Number(l.quantity);
    out.placed += 1;

    // Colors / varieties only carry over if this cycle still offers them.
    if (l.colorKey) {
      const allowed = new Set(resolveColors(t.item, t.available_colors));
      const kept = String(l.colorKey).split(",").filter((c) => c && allowed.has(c));
      if (kept.length) out.colors[key] = kept;
    }
    if (l.varietyKey) {
      const allowed = new Set(resolveVarieties(t.item, t.available_varieties));
      const kept = String(l.varietyKey).split(",").filter((v) => v && allowed.has(v));
      if (kept.length) out.varieties[key] = kept;
    }
  }

  return out;
}
