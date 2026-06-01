/**
 * Order pricing resolution.
 *
 * Mirrors the precedence the order-submit flow freezes onto each line at
 * submit time. Kept here (not in the route file, which may only export HTTP
 * handlers) so it can be unit-tested.
 */

/** Per-availability pricing inputs resolved from items.unit_prices + default_price. */
export interface OrderPriceInfo {
  unitPrices: Record<string, number>;
  defaultPrice: number | null;
}

/**
 * Resolve the unit price for an ordered line.
 *
 * Precedence: unit_prices[unit] → default_price → 0.
 *
 * Defaulting to 0 (rather than null) is deliberate and load-bearing: a line's
 * unit_price_at_order feeds COALESCE(SUM(line_total)) revenue rollups, and a
 * NULL would silently drop the line from totals. A missing availability record
 * (info == null) also resolves to 0. Note a unit price of exactly 0 is a real
 * price and is returned as-is, not treated as "unset".
 */
export function resolveOrderUnitPrice(
  info: OrderPriceInfo | null | undefined,
  unit: string | null | undefined,
): number {
  if (!info) return 0;
  if (unit && typeof info.unitPrices[unit] === "number") return info.unitPrices[unit];
  return info.defaultPrice ?? 0;
}
