import {
  resolveColors,
  resolveSizes,
  resolveUnits,
  resolveVarieties,
} from "@/lib/order-availability";

/**
 * Server-side check that an ordered line's unit / size / colors / varieties
 * are options the availability row actually exposes this cycle.
 *
 * Before this, the order routes trusted whatever strings the client sent:
 * `unit_type` and `size_label` select the frozen price tier
 * (size_prices[size] → unit_prices[unit] → default_price), so a unit the item
 * doesn't sell, or a mistyped size, silently fell through to the default
 * price and was copied into delivery_items by the materializer (2026-10-27).
 *
 * Pure so it can be unit-tested; both order routes call it per line.
 */

export interface LineOptionSource {
  /** Item master lists (comma-separated, as stored on `items`). */
  item: {
    unit_type: string;
    size?: string | null;
    color?: string | null;
    variety?: string | null;
  };
  /** Per-cycle overrides from the `availability_items` row (null = no restriction). */
  available_units?: string | null;
  available_sizes?: string | null;
  available_colors?: string | null;
  available_varieties?: string | null;
}

export interface LineOptions {
  unit_type?: string | null;
  size_label?: string | null;
  /** Comma-separated multi-select keys, as stored on order_items. */
  color_key?: string | null;
  variety_key?: string | null;
}

/** Longest string we accept for any free-text option / note field on a line. */
export const MAX_LINE_TEXT = 500;

function splitKeys(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Returns `null` when the line is acceptable, else a chef-readable reason.
 * `itemName` only decorates the message.
 */
export function validateLineOptions(
  source: LineOptionSource,
  line: LineOptions,
  itemName = "an item",
): string | null {
  const units = resolveUnits(source.item, source.available_units);
  const unit = (line.unit_type ?? "").trim();
  if (unit && !units.includes(unit as (typeof units)[number])) {
    return `${itemName} isn't offered by the ${unit.toUpperCase()} this cycle.`;
  }

  const size = (line.size_label ?? "").trim();
  if (size) {
    if (size.length > MAX_LINE_TEXT) return `Size for ${itemName} is too long.`;
    const sizes = resolveSizes(source.item, source.available_sizes);
    if (!sizes.includes(size)) return `${itemName} isn't offered in size "${size}" this cycle.`;
  }

  const colors = splitKeys(line.color_key);
  if (colors.length > 0) {
    const allowed = new Set(resolveColors(source.item, source.available_colors));
    const bad = colors.find((c) => !allowed.has(c));
    if (bad) return `${itemName} isn't offered in "${bad}" this cycle.`;
  }

  const varieties = splitKeys(line.variety_key);
  if (varieties.length > 0) {
    const allowed = new Set(resolveVarieties(source.item, source.available_varieties));
    const bad = varieties.find((v) => !allowed.has(v));
    if (bad) return `${itemName} isn't offered as "${bad}" this cycle.`;
  }

  return null;
}

/** Trim + cap a free-text field; empty → null. */
export function capText(value: unknown, max = MAX_LINE_TEXT): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

/** Strict YYYY-MM-DD (the shape every date column in this app compares lexically). */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
