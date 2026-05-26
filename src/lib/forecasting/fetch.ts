/**
 * Crop Availability Forecasting — server-side data layer.
 *
 * Thin wrappers that load the rows the pure compute functions need and call
 * them. Server-only: uses the service-role admin client (bypasses RLS) the same
 * way /admin/forecast and /admin/crop-plan do.
 *
 * `(supabase as any)` casts are intentional per repo convention — generated
 * types lag the live schema and these tables are queried with the same pattern
 * elsewhere.
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
  MicrogreenWindow,
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
    is_continuous_harvest, productive_life_days, yield_per_tray
  )
`;

const CROP_SELECT = `
  id, name, variety, ideal_harvest_day, harvest_min_days, harvest_max_days,
  is_continuous_harvest, productive_life_days, yield_per_tray
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
