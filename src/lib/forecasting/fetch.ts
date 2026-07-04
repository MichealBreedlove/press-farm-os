/**
 * Crop Availability Forecasting — server-side data layer.
 *
 * Thin wrappers that load the rows the pure compute functions need and call
 * them. Server-only: uses the service-role admin client (bypasses RLS) the same
 * way /admin/forecast and /admin/crop-plan do.
 *
 * NOTE on `(admin as any)` casts: these tables ARE covered by the generated
 * `src/types/database.ts` now (the old "generated types lag the schema" reason
 * no longer holds). The remaining casts exist only because the multi-line
 * embedded-relation SELECT strings defeat supabase-js literal-type inference.
 * Don't copy this pattern to new code — prefer typed queries and remove casts
 * here opportunistically (see fetchSeasonalItems for the cast-free shape).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, toIso } from "./dates";
import {
  availabilityBuckets,
  cropWindowsInRange,
  fieldCropWindows,
  microgreenEventsInRange,
  microgreenWindowsInRange,
} from "./compute";
import type {
  AvailabilityBuckets,
  FieldCropWindow,
  ForecastCalendarEvent,
  ForecastData,
  ForecastMicrogreenBatchRow,
  ForecastMicrogreenCropRow,
  ForecastPlantingRow,
  HistoricalDeliveryRow,
  MicrogreenWindow,
  SeasonalItemRow,
} from "./types";

const PLANTING_SELECT = `
  id, crop_name, variety, category, item_id,
  sow_date, transplant_date, harvest_start, harvest_end, termination_date,
  days_to_maturity, quantity, quantity_unit, harvest_unit, status, season,
  items ( name, category, unit_type )
`;

const BATCH_SELECT = `
  id, crop_id, sow_date, planned_blackout_end, planned_harvest_date, tray_count,
  crop:microgreen_crops (
    id, name, variety, ideal_harvest_day, harvest_min_days, harvest_max_days,
    is_continuous_harvest, productive_life_days, yield_per_tray, harvest_stage
  )
`;

const CROP_SELECT = `
  id, name, variety, ideal_harvest_day, harvest_min_days, harvest_max_days,
  is_continuous_harvest, productive_life_days, yield_per_tray, harvest_stage
`;

/**
 * Load the full forecasting dataset spanning [from, to] (inclusive).
 *
 * - Field crops: any planting whose harvest window overlaps the range, i.e.
 *   harvest_start <= to AND harvest_end >= from. Cancelled / terminated rows
 *   are filtered out in the compute layer (kept here so callers can inspect).
 * - Microgreens: batches sown recently enough that their harvest window could
 *   still overlap the range. We pull a generous lookback (batches sown up to
 *   ~120 days before `from`, through batches sown up to `to`) and let the
 *   compute layer do the precise window math.
 */
export async function fetchForecastData(
  from: string,
  to: string,
): Promise<ForecastData> {
  const admin = createAdminClient();
  const fromIso = toIso(from);
  const toIsoStr = toIso(to);
  // Generous microgreen sow-date lookback so long-window / continuous crops
  // sown well before the range still surface.
  const batchSowFrom = addDays(fromIso, -120);

  const [plantingsRes, batchesRes, cropsRes] = await Promise.all([
    (admin as any)
      .from("plantings")
      .select(PLANTING_SELECT)
      .lte("harvest_start", toIsoStr)
      .gte("harvest_end", fromIso),
    (admin as any)
      .from("microgreen_batches")
      .select(BATCH_SELECT)
      .gte("sow_date", batchSowFrom)
      .lte("sow_date", toIsoStr),
    (admin as any).from("microgreen_crops").select(CROP_SELECT),
  ]);

  return normalizeForecastData({
    plantings: plantingsRes.data ?? [],
    batches: batchesRes.data ?? [],
    crops: cropsRes.data ?? [],
  });
}

/**
 * Load the dataset needed to compute horizon buckets around `referenceDate`.
 * Window: referenceDate − 30 days (catch already-open field crops) through
 * referenceDate + 75 days (the far edge of the 2-month bucket).
 */
export async function fetchBucketData(referenceDate: string): Promise<ForecastData> {
  const ref = toIso(referenceDate);
  return fetchForecastData(addDays(ref, -30), addDays(ref, 75));
}

// ─── Convenience: fetch + compute in one call (for server components) ──────────

/** Fetch data around `referenceDate` and return the four horizon buckets. */
export async function getAvailabilityBuckets(
  referenceDate: string,
): Promise<AvailabilityBuckets> {
  const data = await fetchBucketData(referenceDate);
  return availabilityBuckets(referenceDate, data);
}

/** Fetch + compute field-crop windows overlapping [from, to]. */
export async function getFieldCropWindows(
  from: string,
  to: string,
): Promise<FieldCropWindow[]> {
  const data = await fetchForecastData(from, to);
  return fieldCropWindows(toIso(from), toIso(to), data.plantings);
}

/** Fetch + compute microgreen windows overlapping [from, to]. */
export async function getMicrogreenWindows(
  from: string,
  to: string,
): Promise<MicrogreenWindow[]> {
  const data = await fetchForecastData(from, to);
  return microgreenWindowsInRange(toIso(from), toIso(to), data.batches, data.crops);
}

/** Fetch + compute all calendar events (field + microgreen) in [from, to]. */
export async function getCalendarEvents(
  from: string,
  to: string,
): Promise<ForecastCalendarEvent[]> {
  const data = await fetchForecastData(from, to);
  const fromIso = toIso(from);
  const toIsoStr = toIso(to);
  return [
    ...cropWindowsInRange(fromIso, toIsoStr, data),
    ...microgreenEventsInRange(fromIso, toIsoStr, data),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

// ─── Normalization ─────────────────────────────────────────────────────────

/**
 * Supabase returns embedded one-to-one relations as an object, but the typed
 * client sometimes surfaces them as a single-element array. Flatten `items`
 * and `crop` so the compute layer sees the documented object-or-null shape.
 */
function normalizeForecastData(raw: {
  plantings: any[];
  batches: any[];
  crops: any[];
}): ForecastData {
  const plantings: ForecastPlantingRow[] = (raw.plantings ?? []).map((p) => ({
    ...p,
    items: Array.isArray(p.items) ? (p.items[0] ?? null) : (p.items ?? null),
  }));

  const batches: ForecastMicrogreenBatchRow[] = (raw.batches ?? []).map((b) => ({
    ...b,
    crop: Array.isArray(b.crop) ? (b.crop[0] ?? null) : (b.crop ?? null),
  }));

  const crops: ForecastMicrogreenCropRow[] = raw.crops ?? [];

  return { plantings, batches, crops };
}

// ─── Year-view fetchers (for /order/forecast) ────────────────────────────────

/**
 * Past delivery actuals for a single restaurant within [from, to].
 * Uses the admin client (bypasses RLS); the caller must have already
 * verified the chef is mapped to this restaurant.
 */
export async function fetchHistoricalDeliveries(
  from: string,
  to: string,
  restaurantId: string,
): Promise<HistoricalDeliveryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("delivery_items")
    .select(`
      quantity,
      unit,
      items!inner ( id, name, category, unit_type ),
      deliveries!inner ( delivery_date, restaurant_id )
    `)
    .gte("deliveries.delivery_date", from)
    .lte("deliveries.delivery_date", to)
    .eq("deliveries.restaurant_id", restaurantId);

  if (error) {
    console.error("[forecasting] fetchHistoricalDeliveries error:", error);
    return [];
  }
  if (!data) return [];

  return data.map((row: any) => ({
    delivery_date: row.deliveries.delivery_date,
    item_id: row.items.id,
    item_name: row.items.name,
    category: row.items.category,
    unit_type: row.items.unit_type,
    quantity: Number(row.quantity),
    unit: row.unit,
  }));
}

/**
 * All non-archived items with non-empty seasonal_months. Single-farm
 * assumption — the items table is single-farm in this app.
 */
export async function fetchSeasonalItems(): Promise<SeasonalItemRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("items")
    .select("id, name, category, seasonal_months")
    .eq("is_archived", false);

  if (error) {
    console.error("[forecasting] fetchSeasonalItems error:", error);
    return [];
  }
  if (!data) return [];

  return data
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      seasonal_months: (row.seasonal_months ?? []) as number[],
    }))
    .filter((it: SeasonalItemRow) => it.seasonal_months.length > 0);
}
