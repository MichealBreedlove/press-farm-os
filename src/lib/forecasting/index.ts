/**
 * Crop Availability Forecasting — public API.
 *
 * Forward-looking complement to /admin/forecast (which is historical). Answers
 * "what crops are harvestable/available in a given date window," unioning field
 * crops (`plantings`) and microgreens (`microgreen_batches` + `microgreen_crops`).
 *
 * Shared foundation for new calendars + emails. Import from "@/lib/forecasting".
 *
 *   Pure compute (unit-testable, no I/O):
 *     - fieldCropWindows(from, to, plantings)
 *     - microgreenWindows(batches, crops)
 *     - microgreenWindowsInRange(from, to, batches, crops)
 *     - availabilityBuckets(referenceDate, data)
 *     - cropWindowsInRange(from, to, data)         → calendar events (field)
 *     - microgreenEventsInRange(from, to, data)    → calendar events (microgreen)
 *
 *   Server data layer (Supabase, admin client):
 *     - fetchForecastData(from, to)
 *     - fetchBucketData(referenceDate)
 *     - getAvailabilityBuckets(referenceDate)
 *     - getFieldCropWindows(from, to)
 *     - getMicrogreenWindows(from, to)
 *     - getCalendarEvents(from, to)
 *
 *   Date helpers (UTC ISO-date math):
 *     - addDays, daysBetween, isWithin, isoDateUtc, toIso
 *
 *   Horizon constants:
 *     - NOW_MAX_DAYS, TWO_WEEKS_DAYS, FOUR_WEEKS_DAYS, TWO_MONTHS_DAYS
 */

// Pure compute functions + horizon constants
export {
  fieldCropWindows,
  microgreenWindows,
  microgreenWindowsInRange,
  availabilityBuckets,
  cropWindowsInRange,
  microgreenEventsInRange,
  NOW_MAX_DAYS,
  TWO_WEEKS_DAYS,
  FOUR_WEEKS_DAYS,
  TWO_MONTHS_DAYS,
} from "./compute";

// Server-side data layer (do not import into client components)
export {
  fetchForecastData,
  fetchBucketData,
  getAvailabilityBuckets,
  getFieldCropWindows,
  getMicrogreenWindows,
  getCalendarEvents,
} from "./fetch";

// Date helpers
export { addDays, daysBetween, isWithin, isoDateUtc, toIso } from "./dates";

// Public types
export type {
  ForecastSource,
  HorizonKey,
  ForecastPlantingRow,
  ForecastMicrogreenCropRow,
  ForecastMicrogreenBatchRow,
  ForecastData,
  FieldCropWindow,
  MicrogreenWindow,
  AvailabilityEntry,
  AvailabilityBuckets,
  FieldEventType,
  MicrogreenEventType,
  ForecastCalendarEvent,
} from "./types";
