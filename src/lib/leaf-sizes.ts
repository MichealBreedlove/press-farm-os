/**
 * Leaf-size → inch guide.
 *
 * Small-leaf items (the frilly mustards, Moonshadow, Wasabina, Kale Mix…) are
 * sold by a generic size word — Baby / Small / Medium / Large — and chefs had
 * no way to know how big a "Medium" leaf actually is. Micheal's scale
 * (2026-11-09):
 *
 *   Baby    1–2"
 *   Small   2–4"
 *   Medium  4–6"
 *   Large   6–10"
 *
 * The size word stays the stored label (`items.size`, `order_items.size_label`,
 * per-cycle `available_sizes`, `size_prices` keys) — the inch range is a
 * DISPLAY hint only, appended wherever a chef, admin or harvester reads the
 * label. It applies to leaf categories only: a "Baby" tomato or carrot is not
 * 1–2" across.
 */

import type { ItemCategory } from "@/types";

export const LEAF_SIZE_INCHES: Record<string, string> = {
  baby: '1–2"',
  small: '2–4"',
  medium: '4–6"',
  large: '6–10"',
};

/** Categories whose generic size words mean leaf length. */
export const LEAF_SIZE_CATEGORIES: ReadonlySet<string> = new Set<ItemCategory>([
  "herbs_leaves",
  "micros_leaves",
]);

/** `'1–2"'` for a leaf item's "Baby"; null for any other size or category. */
export function leafSizeInches(
  size: string | null | undefined,
  category: string | null | undefined,
): string | null {
  if (!size || !category || !LEAF_SIZE_CATEGORIES.has(category)) return null;
  return LEAF_SIZE_INCHES[size.trim().toLowerCase()] ?? null;
}

/** `Baby · 1–2"` for leaf items; the bare label otherwise. Empty string for no size. */
export function formatSizeLabel(
  size: string | null | undefined,
  category: string | null | undefined,
): string {
  if (!size) return "";
  const inches = leafSizeInches(size, category);
  return inches ? `${size} · ${inches}` : size;
}
