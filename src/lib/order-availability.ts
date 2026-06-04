import type { UnitType } from "@/types/database";

/** Split a comma-separated DB string into trimmed, non-empty parts.
 *  Handles both "a, b" (item master) and "a,b" (per-cycle override) spacing. */
function splitList(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Filter an item's master option list by a per-cycle availability override.
 *
 *  The override (`available_sizes` / `available_colors` / `available_units` on an
 *  `availability_items` row) is the source of truth for what the chef may pick this
 *  cycle. `null`/`undefined` means "no per-cycle restriction — all master options
 *  available"; a comma-separated string restricts to that subset. */
export function filterAvailable<T extends string>(
  master: T[],
  override: string | null | undefined,
): T[] {
  if (override === null || override === undefined) return master;
  const allowed = new Set(splitList(override));
  return master.filter((v) => allowed.has(v));
}

/** Units this availability row exposes to the chef (per-cycle override ∩ item master). */
export function resolveUnits(
  item: { unit_type: string },
  availableUnits: string | null | undefined,
): UnitType[] {
  return filterAvailable(splitList(item.unit_type) as UnitType[], availableUnits);
}

/** Sizes this availability row exposes to the chef (per-cycle override ∩ item master). */
export function resolveSizes(
  item: { size?: string | null },
  availableSizes: string | null | undefined,
): string[] {
  return filterAvailable(splitList(item.size), availableSizes);
}

/** Colors this availability row exposes to the chef (per-cycle override ∩ item master). */
export function resolveColors(
  item: { color?: string | null },
  availableColors: string | null | undefined,
): string[] {
  return filterAvailable(splitList(item.color), availableColors);
}
