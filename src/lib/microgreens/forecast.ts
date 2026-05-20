import { FORECAST_LOOKBACK_WEEKS } from "./constants";

type DeliveryItemRow = {
  delivery_date: string;
  quantity_oz: number;
  item_id: string;
};

const MS_PER_DAY = 24 * 3600 * 1000;

export function computeForecast(
  rows: DeliveryItemRow[],
  itemId: string | null,
  dayOfWeek: number,
  now: Date,
): number {
  if (!itemId) return 0;

  const cutoff = now.getTime() - FORECAST_LOOKBACK_WEEKS * 7 * MS_PER_DAY;
  const matches = rows.filter((r) => {
    if (r.item_id !== itemId) return false;
    const d = new Date(r.delivery_date + "T00:00:00Z");
    if (d.getUTCDay() !== dayOfWeek) return false;
    return d.getTime() >= cutoff && d.getTime() <= now.getTime();
  });

  if (matches.length === 0) return 0;
  const total = matches.reduce((sum, r) => sum + (r.quantity_oz ?? 0), 0);
  return total / matches.length;
}
