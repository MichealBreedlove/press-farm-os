/**
 * Press Farm OS — report aggregation primitives.
 *
 * The income / monthly / dashboard reports each re-implemented the same
 * "loop rows, sum a field per key" and "roll deliveries + expenses into
 * per-month buckets with a per-restaurant split" logic. These pure helpers are
 * the shared core. Callers keep their own restaurant-name fallback (some use
 * the restaurant id, some "Unknown") by passing it in, so behaviour is
 * identical to the hand-rolled loops they replace.
 */

/** Group rows and sum a numeric field per key. */
export function sumByKey<T>(
  rows: readonly T[],
  keyFn: (row: T) => string,
  valFn: (row: T) => number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = keyFn(row);
    out[k] = (out[k] ?? 0) + valFn(row);
  }
  return out;
}

export interface DeliveryRollupRow {
  delivery_date: string;
  total_value: number | null;
}

export interface ExpenseRollupRow {
  date: string;
  amount: number | null;
}

export interface MonthRollup {
  month: string; // YYYY-MM
  total_value: number;
  total_expenses: number;
  by_restaurant: Record<string, number>;
}

/**
 * Roll deliveries + expenses into per-`YYYY-MM` buckets with a per-restaurant
 * revenue split. `restaurantNameOf` resolves each delivery's restaurant label.
 * Returns the bucket map keyed by month; callers sort / add labels / compute
 * net as they see fit.
 */
export function rollupByMonth<D extends DeliveryRollupRow, E extends ExpenseRollupRow>(
  deliveries: readonly D[],
  expenses: readonly E[],
  restaurantNameOf: (delivery: D) => string,
): Record<string, MonthRollup> {
  const map: Record<string, MonthRollup> = {};
  const ensure = (m: string): MonthRollup =>
    (map[m] ??= { month: m, total_value: 0, total_expenses: 0, by_restaurant: {} });

  for (const d of deliveries) {
    const bucket = ensure(d.delivery_date.slice(0, 7));
    const value = d.total_value ?? 0;
    bucket.total_value += value;
    const name = restaurantNameOf(d);
    bucket.by_restaurant[name] = (bucket.by_restaurant[name] ?? 0) + value;
  }

  for (const e of expenses) {
    ensure(e.date.slice(0, 7)).total_expenses += e.amount ?? 0;
  }

  return map;
}
