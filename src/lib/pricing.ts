/**
 * Order pricing resolution.
 *
 * Mirrors the precedence the order-submit flow freezes onto each line at
 * submit time. Kept here (not in the route file, which may only export HTTP
 * handlers) so it can be unit-tested.
 */

/** Per-availability pricing inputs resolved from items.unit_prices + default_price (+ size_prices). */
export interface OrderPriceInfo {
  unitPrices: Record<string, number>;
  defaultPrice: number | null;
  /** Per-size overrides keyed by size_label (items.size_prices). Most specific tier. */
  sizePrices?: Record<string, number> | null;
}

/**
 * Resolve the unit price for an ordered line.
 *
 * Precedence: size_prices[size] → unit_prices[unit] → default_price → 0.
 *
 * A size price is the most specific tier (e.g. Nasturtium "Palm" = $1/ea while
 * the same item's other sizes fall through to the $0.40 per-unit price). Only
 * items that have a size_prices entry for the line's size are affected; every
 * other item resolves exactly as before.
 *
 * Defaulting to 0 (rather than null) is deliberate and load-bearing: a line's
 * unit_price_at_order feeds COALESCE(SUM(line_total)) revenue rollups, and a
 * NULL would silently drop the line from totals. A missing availability record
 * (info == null) also resolves to 0. Note a price of exactly 0 is a real
 * price and is returned as-is, not treated as "unset".
 */
export function resolveOrderUnitPrice(
  info: OrderPriceInfo | null | undefined,
  unit: string | null | undefined,
  size?: string | null | undefined,
): number {
  if (!info) return 0;
  const sz = (size ?? "").trim();
  if (sz && info.sizePrices && typeof info.sizePrices[sz] === "number") return info.sizePrices[sz];
  if (unit && typeof info.unitPrices[unit] === "number") return info.unitPrices[unit];
  return info.defaultPrice ?? 0;
}
