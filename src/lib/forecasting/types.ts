/**
 * Crop Availability Forecasting — public types.
 *
 * These shapes are the contract for downstream calendar + email work.
 * They are defined HERE (not in src/types/*) so the lib owns its own API.
 *
 * Two sources of supply are unioned:
 *   - "field"      → rows from `plantings` (harvest_start..harvest_end window)
 *   - "microgreen" → rows from `microgreen_batches` JOIN `microgreen_crops`
 */

/** Where an availability entry originated. */
export type ForecastSource = "field" | "microgreen";

/**
 * Horizon bucket keys, in increasing distance from the reference date.
 *  - now      : currently in-window on the reference date (harvestable today / this delivery)
 *  - in2Weeks : window opens roughly two weeks out
 *  - in4Weeks : window opens roughly four weeks out
 *  - in2Months: window opens roughly two months out
 */
export type HorizonKey = "now" | "in2Weeks" | "in4Weeks" | "in2Months";

/**
 * Minimal field-crop (planting) row this lib needs. A superset of the live
 * `plantings` columns — callers pass already-fetched rows, optionally with a
 * joined `items` relation for display name / unit.
 */
export interface ForecastPlantingRow {
  id: string;
  crop_name: string;
  variety: string | null;
  category: string | null;
  item_id: string | null;
  sow_date: string | null;
  transplant_date: string | null;
  harvest_start: string | null;
  harvest_end: string | null;
  termination_date: string | null;
  days_to_maturity: number | null;
  quantity: number | null;
  quantity_unit: string | null;
  harvest_unit: string | null;
  status: string | null;
  season: number | null;
  /** Joined items relation (Supabase returns object or null). */
  items?: { name: string | null; category: string | null; unit_type: string | null } | null;
}

/**
 * Minimal microgreen crop row this lib needs (subset of `microgreen_crops`).
 */
export interface ForecastMicrogreenCropRow {
  id: string;
  name: string;
  variety: string | null;
  ideal_harvest_day: number;
  harvest_min_days: number | null;
  harvest_max_days: number | null;
  is_continuous_harvest: boolean;
  productive_life_days: number | null;
  /** e.g. {"lg":4,"sm":8,"ea":32} — yield of one tray, per packing unit. */
  yield_per_tray: Record<string, number> | null;
}

/**
 * Minimal microgreen batch row this lib needs (subset of `microgreen_batches`),
 * optionally with its joined crop.
 */
export interface ForecastMicrogreenBatchRow {
  id: string;
  crop_id: string;
  sow_date: string;
  planned_blackout_end: string | null;
  planned_harvest_date: string;
  tray_count: number;
  /** Joined crop relation when fetched together. */
  crop?: ForecastMicrogreenCropRow | null;
}

/**
 * The full, already-fetched dataset the pure functions operate on.
 * No I/O happens in the compute layer — `fetch.ts` produces this.
 */
export interface ForecastData {
  plantings: ForecastPlantingRow[];
  batches: ForecastMicrogreenBatchRow[];
  /** Crops keyed/looked up by id; pass the full list, lib indexes it. */
  crops: ForecastMicrogreenCropRow[];
}

/**
 * A computed field-crop availability window.
 */
export interface FieldCropWindow {
  source: "field";
  plantingId: string;
  name: string;
  category: string | null;
  /** harvest_start (ISO date). */
  windowStart: string;
  /** harvest_end (ISO date). */
  windowEnd: string;
  quantity: number | null;
  /** Display unit for the quantity / harvest (harvest_unit ?? items.unit_type). */
  unit: string | null;
}

/**
 * A computed microgreen batch harvest window. Both "seeded on" and "ready on"
 * are surfaced because the chef calendar shows both.
 */
export interface MicrogreenWindow {
  source: "microgreen";
  batchId: string;
  cropId: string;
  name: string;
  /** sow_date (ISO date) — "seeded on". */
  seededOn: string;
  /** ideal harvest date (planned_harvest_date or sow_date + ideal_harvest_day). */
  readyOn: string;
  /** sow_date + harvest_min_days (ISO date). */
  windowOpen: string;
  /**
   * sow_date + harvest_max_days, extended to sow_date + productive_life_days
   * for continuous-harvest crops (ISO date).
   */
  windowClose: string;
  trayCount: number;
  /** True when windowClose was extended by continuous-harvest productive life. */
  isContinuous: boolean;
  /** Human estimate of yield, e.g. "12 LG / 24 SM" derived from yield_per_tray. */
  estimate: string | null;
}

/**
 * A single entry inside a horizon bucket — uniform across both sources.
 */
export interface AvailabilityEntry {
  name: string;
  category: string | null;
  source: ForecastSource;
  /** ISO date the supply window opens. */
  windowStart: string;
  /** ISO date the supply window closes. */
  windowEnd: string;
  /** Optional human-readable quantity/yield estimate. */
  estimate?: string;
  /** Optional display unit. */
  unit?: string;
}

/**
 * The four horizon buckets returned by `availabilityBuckets`.
 */
export interface AvailabilityBuckets {
  /** The reference date the buckets were computed against (ISO date). */
  referenceDate: string;
  now: AvailabilityEntry[];
  in2Weeks: AvailabilityEntry[];
  in4Weeks: AvailabilityEntry[];
  in2Months: AvailabilityEntry[];
}

/**
 * Calendar event kinds for field crops.
 */
export type FieldEventType = "harvest-start" | "harvest-end";

/**
 * Calendar event kinds for microgreens. Modeled on
 * src/components/admin/microgreens/CalendarView.tsx so a calendar can render
 * field + microgreen events with one shared shape.
 */
export type MicrogreenEventType =
  | "sow"
  | "harvest-open"
  | "harvest-ideal"
  | "harvest-close";

/**
 * A calendar-friendly event. `type` is the union of field + microgreen kinds.
 */
export interface ForecastCalendarEvent {
  /** ISO date the event lands on. */
  date: string;
  source: ForecastSource;
  type: FieldEventType | MicrogreenEventType;
  /** Short human label, e.g. "Harvest opens: Pea Shoots". */
  label: string;
  /** Crop / item display name (no prefix). */
  name: string;
  category: string | null;
  /** Originating planting id (field) or batch id (microgreen). */
  refId: string;
}

// ─── Year-view types (for /order/forecast) ───────────────────────────────────

/**
 * Past delivery actuals row — what was actually shipped to a restaurant in
 * a given week. Sourced from delivery_items JOIN deliveries.
 */
export interface HistoricalDeliveryRow {
  delivery_date: string;
  item_id: string;
  item_name: string;
  category: string | null;
  unit_type: string | null;
  quantity: number;
  unit: string;
}

/**
 * Item with seasonal_months populated — used by the far-future "seasonal" zone.
 */
export interface SeasonalItemRow {
  id: string;
  name: string;
  category: string | null;
  seasonal_months: number[];
}

/**
 * A bucket of historical deliveries grouped by ISO week.
 */
export interface WeekBucket {
  /** ISO week-start date (Monday), YYYY-MM-DD. */
  weekStart: string;
  /** Distinct items delivered that week, sorted by name. */
  items: Array<{
    id: string;
    name: string;
    category: string | null;
    unit_type: string | null;
    /** Sum across all delivery_items rows for that item in that week. */
    quantity: number;
    /** Most-common unit for that item-week (e.g. "lb" or "lg"). */
    unit: string;
  }>;
}

/**
 * Density bucket for a single month in the year strip.
 */
export interface MonthDensity {
  /** 1=Jan..12=Dec */
  month: number;
  /** Distinct-item count, deduplicated across all three zones (by lowercased name). */
  count: number;
  /** Highest-priority zone touching this month, used to pick tab styling.
   *  Priority order: past > concrete > seasonal > empty. */
  zone: "past" | "concrete" | "seasonal" | "empty";
}
