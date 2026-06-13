/**
 * Press Farm OS — Order-form quantity-key conventions (single source of truth).
 *
 * The chef order form stores every cell's quantity/color/note in flat
 * `Record<key, …>` maps. The key encodes the (availability item, unit, size)
 * tuple. These builders are the ONE place that format is defined — the form,
 * the item row, the category counter, and the draft-rehydration paths all
 * route through here so the shapes can never drift apart (a drift silently
 * orphans quantities).
 *
 *   multi-unit + size:    ${availId}__unit:${unit}__${size}
 *   multi-unit, no size:  ${availId}__unit:${unit}
 *   single unit + size:   ${availId}__${size}        (legacy)
 *   single unit, no size: ${availId}                 (legacy)
 *
 * `unit` is encoded only when the item exposes more than one unit
 * (`hasMultiUnits`); single-unit items never carry a unit segment. Whether an
 * item is multi-unit is the CALLER's decision (the form resolves it from the
 * per-cycle availability override; the draft loader from the raw item) — this
 * module just takes the boolean, so each call site keeps its own semantics.
 */

import type { UnitType } from "@/types";

/** Build the quantity-state key for one (availability item, unit, size) cell. */
export function buildOrderKey(
  availId: string,
  opts: { unit?: string | null; size?: string | null; hasMultiUnits?: boolean } = {},
): string {
  let key = availId;
  if (opts.unit && opts.hasMultiUnits) key += `__unit:${opts.unit}`;
  if (opts.size) key += `__${opts.size}`;
  return key;
}

export interface EnumeratedKey {
  key: string;
  unit?: UnitType;
  size?: string;
}

/**
 * Every quantity key a (units, sizes) combination produces for one
 * availability item — the form iterates these to render cells and to sweep
 * quantities. `units` must already be the resolved, availability-overridden
 * unit list (its length decides the multi-unit branch).
 */
export function* enumerateOrderKeys(
  availId: string,
  units: UnitType[],
  sizes: string[],
): Generator<EnumeratedKey> {
  const hasMultiUnits = units.length > 1;
  const hasSizes = sizes.length > 0;
  if (hasMultiUnits && hasSizes) {
    for (const u of units)
      for (const s of sizes)
        yield { key: buildOrderKey(availId, { unit: u, size: s, hasMultiUnits }), unit: u, size: s };
  } else if (hasMultiUnits) {
    for (const u of units) yield { key: buildOrderKey(availId, { unit: u, hasMultiUnits }), unit: u };
  } else if (hasSizes) {
    for (const s of sizes) yield { key: buildOrderKey(availId, { size: s }), size: s };
  } else {
    yield { key: availId };
  }
}
