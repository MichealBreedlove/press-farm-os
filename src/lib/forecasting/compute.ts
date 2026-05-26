/**
 * Crop Availability Forecasting — pure compute functions.
 *
 * Every function here accepts already-fetched row arrays and returns structured
 * results with no I/O, so they're fully unit-testable. The server data layer
 * (fetch.ts) is the only place that talks to Supabase.
 *
 * Two supply sources are unioned:
 *   - field crops  → `plantings` (harvest_start..harvest_end)
 *   - microgreens  → `microgreen_batches` JOIN `microgreen_crops`
 */

import { addDays, daysBetween, isWithin } from "./dates";
import type {
  AvailabilityBuckets,
  AvailabilityEntry,
  FieldCropWindow,
  ForecastCalendarEvent,
  ForecastData,
  ForecastMicrogreenBatchRow,
  ForecastMicrogreenCropRow,
  ForecastPlantingRow,
  MicrogreenWindow,
} from "./types";

// ─── Horizon bucket boundaries ───────────────────────────────────────────────
// "now" means currently in-window on the reference date. The forward buckets
// are keyed by when a crop's supply WINDOW OPENS relative to the reference
// date. Boundaries are inclusive ranges of "days until window opens".
//
// NOW_MAX_DAYS = 13 covers roughly the next delivery cycle (Press delivers
// Thu/Sat/Mon, so ~the next two weeks of cuttings) for windows that haven't
// opened yet but open imminently. Anything already open on the reference date
// also lands in `now` regardless of these bounds.
export const NOW_MAX_DAYS = 13; // 0–13 days out → "now / this cycle"
export const TWO_WEEKS_DAYS = 14; // center of the ~2-week bucket
export const FOUR_WEEKS_DAYS = 28; // center of the ~4-week bucket
export const TWO_MONTHS_DAYS = 60; // center of the ~2-month bucket

// Half-width windows around each forward target so a crop opening on day 14±6
// counts as "in 2 weeks", etc. Tuned to tile the timeline without large gaps.
const TWO_WEEKS_RANGE: readonly [number, number] = [NOW_MAX_DAYS + 1, 20]; // 14–20
const FOUR_WEEKS_RANGE: readonly [number, number] = [21, 41]; // ~4 weeks
const TWO_MONTHS_RANGE: readonly [number, number] = [42, 74]; // ~2 months

// ─── Field crops ─────────────────────────────────────────────────────────────

const EXCLUDED_PLANTING_STATUSES: ReadonlySet<string> = new Set([
  "cancelled",
  "terminated",
]);

/** Display name for a planting: prefer joined item name, else crop_name. */
function plantingName(p: ForecastPlantingRow): string {
  const itemName = p.items?.name?.trim();
  return itemName && itemName.length > 0 ? itemName : p.crop_name;
}

/** Display unit for a planting: harvest_unit, else joined item unit_type. */
function plantingUnit(p: ForecastPlantingRow): string | null {
  return p.harvest_unit ?? p.items?.unit_type ?? null;
}

/** Display category for a planting: own category, else joined item category. */
function plantingCategory(p: ForecastPlantingRow): string | null {
  return p.category ?? p.items?.category ?? null;
}

/** A planting can supply if it has a harvest window and isn't cancelled/terminated. */
function plantingIsLive(p: ForecastPlantingRow): boolean {
  if (!p.harvest_start || !p.harvest_end) return false;
  const status = (p.status ?? "").toLowerCase();
  return !EXCLUDED_PLANTING_STATUSES.has(status);
}

/**
 * Field-crop harvest windows that overlap [from, to] (inclusive).
 * A planting overlaps when harvest_start <= to AND harvest_end >= from.
 * Cancelled / terminated plantings are excluded.
 */
export function fieldCropWindows(
  from: string,
  to: string,
  plantings: ForecastPlantingRow[],
): FieldCropWindow[] {
  const out: FieldCropWindow[] = [];
  for (const p of plantings) {
    if (!plantingIsLive(p)) continue;
    const start = p.harvest_start as string;
    const end = p.harvest_end as string;
    // overlap test
    if (start > to || end < from) continue;
    out.push({
      source: "field",
      plantingId: p.id,
      name: plantingName(p),
      category: plantingCategory(p),
      windowStart: start,
      windowEnd: end,
      quantity: p.quantity ?? null,
      unit: plantingUnit(p),
    });
  }
  out.sort((a, b) => a.windowStart.localeCompare(b.windowStart) || a.name.localeCompare(b.name));
  return out;
}

// ─── Microgreens ─────────────────────────────────────────────────────────────

/**
 * Build a human-readable yield estimate from a crop's yield_per_tray map and a
 * batch's tray count, e.g. "12 LG / 24 SM". Returns null when no usable map.
 */
function yieldEstimate(
  crop: ForecastMicrogreenCropRow,
  trayCount: number,
): string | null {
  const map = crop.yield_per_tray;
  if (!map) return null;
  const parts: string[] = [];
  for (const [unit, perTray] of Object.entries(map)) {
    const per = Number(perTray);
    if (!Number.isFinite(per) || per <= 0) continue;
    parts.push(`${per * trayCount} ${unit.toUpperCase()}`);
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}

/** Compute a single batch's harvest window using its joined/looked-up crop. */
function batchWindow(
  batch: ForecastMicrogreenBatchRow,
  crop: ForecastMicrogreenCropRow,
): MicrogreenWindow {
  const minDays = crop.harvest_min_days ?? crop.ideal_harvest_day;
  const maxDays = crop.harvest_max_days ?? crop.ideal_harvest_day;

  const windowOpen = addDays(batch.sow_date, minDays);
  let windowClose = addDays(batch.sow_date, maxDays);

  // Continuous-harvest crops keep producing through their productive life.
  if (crop.is_continuous_harvest && crop.productive_life_days != null) {
    const lifeEnd = addDays(batch.sow_date, crop.productive_life_days);
    if (lifeEnd > windowClose) windowClose = lifeEnd;
  }

  // planned_harvest_date is NOT NULL in the schema, but guard empty strings too
  // so a blank value falls back to the computed ideal harvest day.
  const readyOn = batch.planned_harvest_date && batch.planned_harvest_date.length >= 10
    ? batch.planned_harvest_date
    : addDays(batch.sow_date, crop.ideal_harvest_day);

  return {
    source: "microgreen",
    batchId: batch.id,
    cropId: crop.id,
    name: crop.variety ? `${crop.name} — ${crop.variety}` : crop.name,
    seededOn: batch.sow_date,
    readyOn,
    windowOpen,
    windowClose,
    trayCount: batch.tray_count,
    isContinuous: crop.is_continuous_harvest,
    estimate: yieldEstimate(crop, batch.tray_count),
  };
}

/** Index crops by id, merging any per-batch joined crop so callers can pass either. */
function cropIndex(
  crops: ForecastMicrogreenCropRow[],
  batches: ForecastMicrogreenBatchRow[],
): Map<string, ForecastMicrogreenCropRow> {
  const idx = new Map<string, ForecastMicrogreenCropRow>();
  for (const c of crops) idx.set(c.id, c);
  for (const b of batches) {
    if (b.crop && !idx.has(b.crop.id)) idx.set(b.crop.id, b.crop);
  }
  return idx;
}

/**
 * All microgreen batch harvest windows. Batches whose crop can't be resolved
 * (no entry in `crops` and no joined `crop`) are skipped.
 */
export function microgreenWindows(
  batches: ForecastMicrogreenBatchRow[],
  crops: ForecastMicrogreenCropRow[],
): MicrogreenWindow[] {
  const idx = cropIndex(crops, batches);
  const out: MicrogreenWindow[] = [];
  for (const b of batches) {
    const crop = b.crop ?? idx.get(b.crop_id);
    if (!crop) continue;
    out.push(batchWindow(b, crop));
  }
  out.sort((a, b) => a.windowOpen.localeCompare(b.windowOpen) || a.name.localeCompare(b.name));
  return out;
}

/**
 * Microgreen harvest windows whose [windowOpen, windowClose] overlaps [from, to].
 */
export function microgreenWindowsInRange(
  from: string,
  to: string,
  batches: ForecastMicrogreenBatchRow[],
  crops: ForecastMicrogreenCropRow[],
): MicrogreenWindow[] {
  return microgreenWindows(batches, crops).filter(
    (w) => !(w.windowOpen > to || w.windowClose < from),
  );
}

// ─── Unified buckets ─────────────────────────────────────────────────────────

/** Map "days until window opens" to a forward horizon key, or null if it doesn't fit. */
function forwardBucketFor(daysUntilOpen: number): Exclude<keyof AvailabilityBuckets, "referenceDate" | "now"> | null {
  if (daysUntilOpen >= TWO_WEEKS_RANGE[0] && daysUntilOpen <= TWO_WEEKS_RANGE[1]) return "in2Weeks";
  if (daysUntilOpen >= FOUR_WEEKS_RANGE[0] && daysUntilOpen <= FOUR_WEEKS_RANGE[1]) return "in4Weeks";
  if (daysUntilOpen >= TWO_MONTHS_RANGE[0] && daysUntilOpen <= TWO_MONTHS_RANGE[1]) return "in2Months";
  return null;
}

function fieldEntry(w: FieldCropWindow): AvailabilityEntry {
  const entry: AvailabilityEntry = {
    name: w.name,
    category: w.category,
    source: "field",
    windowStart: w.windowStart,
    windowEnd: w.windowEnd,
  };
  if (w.quantity != null) entry.estimate = `~${w.quantity}${w.unit ? ` ${w.unit}` : ""}`;
  if (w.unit) entry.unit = w.unit;
  return entry;
}

function microgreenEntry(w: MicrogreenWindow): AvailabilityEntry {
  const entry: AvailabilityEntry = {
    name: w.name,
    category: "micro",
    source: "microgreen",
    windowStart: w.windowOpen,
    windowEnd: w.windowClose,
  };
  if (w.estimate) entry.estimate = w.estimate;
  return entry;
}

/**
 * Union field crops + microgreens into four horizon buckets relative to
 * `referenceDate`.
 *
 *  - `now`:        window is OPEN on referenceDate (windowStart <= ref <= windowEnd),
 *                  OR opens within the next NOW_MAX_DAYS days (this delivery cycle).
 *  - `in2Weeks`:   window opens 14–20 days out.
 *  - `in4Weeks`:   window opens 21–41 days out.
 *  - `in2Months`:  window opens 42–74 days out.
 *
 * A crop already open "now" is NOT also listed in a forward bucket. Crops whose
 * window opens between the forward ranges (e.g. nothing fits) are simply omitted
 * — buckets are a curated horizon view, not an exhaustive list (use
 * cropWindowsInRange / microgreenEventsInRange for that).
 */
export function availabilityBuckets(
  referenceDate: string,
  data: ForecastData,
): AvailabilityBuckets {
  const ref = referenceDate.slice(0, 10);
  const buckets: AvailabilityBuckets = {
    referenceDate: ref,
    now: [],
    in2Weeks: [],
    in4Weeks: [],
    in2Months: [],
  };

  const place = (
    entry: AvailabilityEntry,
    windowStart: string,
    windowEnd: string,
  ) => {
    if (isWithin(ref, windowStart, windowEnd)) {
      buckets.now.push(entry);
      return;
    }
    if (windowStart < ref) return; // already closed — not in any forward bucket
    const daysUntilOpen = daysBetween(ref, windowStart);
    if (daysUntilOpen <= NOW_MAX_DAYS) {
      buckets.now.push(entry);
      return;
    }
    const key = forwardBucketFor(daysUntilOpen);
    if (key) buckets[key].push(entry);
  };

  for (const w of fieldCropWindows(ref, addDays(ref, TWO_MONTHS_RANGE[1]), data.plantings)) {
    place(fieldEntry(w), w.windowStart, w.windowEnd);
  }
  // Field windows that are open now but started before `ref` (so excluded by the
  // range scan above) still need to land in `now`. Re-scan those explicitly.
  for (const p of data.plantings) {
    if (!plantingIsLive(p)) continue;
    const start = p.harvest_start as string;
    const end = p.harvest_end as string;
    if (start < ref && isWithin(ref, start, end)) {
      buckets.now.push(fieldEntry({
        source: "field",
        plantingId: p.id,
        name: plantingName(p),
        category: plantingCategory(p),
        windowStart: start,
        windowEnd: end,
        quantity: p.quantity ?? null,
        unit: plantingUnit(p),
      }));
    }
  }

  for (const w of microgreenWindows(data.batches, data.crops)) {
    place(microgreenEntry(w), w.windowOpen, w.windowClose);
  }

  const byName = (a: AvailabilityEntry, b: AvailabilityEntry) =>
    a.windowStart.localeCompare(b.windowStart) || a.name.localeCompare(b.name);
  buckets.now.sort(byName);
  buckets.in2Weeks.sort(byName);
  buckets.in4Weeks.sort(byName);
  buckets.in2Months.sort(byName);

  return buckets;
}

// ─── Calendar events ─────────────────────────────────────────────────────────

/**
 * Calendar-friendly field-crop events in [from, to]. Emits a `harvest-start`
 * event on harvest_start and a `harvest-end` event on harvest_end for any
 * planting whose either endpoint lands in the range.
 */
export function cropWindowsInRange(
  from: string,
  to: string,
  data: ForecastData,
): ForecastCalendarEvent[] {
  const out: ForecastCalendarEvent[] = [];
  for (const p of data.plantings) {
    if (!plantingIsLive(p)) continue;
    const name = plantingName(p);
    const category = plantingCategory(p);
    const start = p.harvest_start as string;
    const end = p.harvest_end as string;
    if (isWithin(start, from, to)) {
      out.push({
        date: start,
        source: "field",
        type: "harvest-start",
        label: `Harvest opens: ${name}`,
        name,
        category,
        refId: p.id,
      });
    }
    if (isWithin(end, from, to)) {
      out.push({
        date: end,
        source: "field",
        type: "harvest-end",
        label: `Harvest closes: ${name}`,
        name,
        category,
        refId: p.id,
      });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return out;
}

/**
 * Calendar-friendly microgreen events in [from, to]. Per batch emits:
 *  - sow           on sow_date
 *  - harvest-open  on sow_date + harvest_min_days (only if distinct from ideal)
 *  - harvest-ideal on planned_harvest_date (or sow_date + ideal_harvest_day)
 *  - harvest-close on windowClose (only if distinct from ideal)
 *
 * Event kinds mirror src/components/admin/microgreens/CalendarView.tsx so a
 * shared calendar can render them.
 */
export function microgreenEventsInRange(
  from: string,
  to: string,
  data: ForecastData,
): ForecastCalendarEvent[] {
  const windows = microgreenWindows(data.batches, data.crops);
  const out: ForecastCalendarEvent[] = [];

  for (const w of windows) {
    const push = (date: string, type: ForecastCalendarEvent["type"], label: string) => {
      if (!isWithin(date, from, to)) return;
      out.push({ date, source: "microgreen", type, label, name: w.name, category: "micro", refId: w.batchId });
    };

    push(w.seededOn, "sow", `Sow ${w.trayCount}× ${w.name}`);
    if (w.windowOpen !== w.readyOn) {
      push(w.windowOpen, "harvest-open", `Harvest opens: ${w.name}`);
    }
    push(w.readyOn, "harvest-ideal", `Harvest ideal: ${w.name}`);
    if (w.windowClose !== w.readyOn) {
      push(w.windowClose, "harvest-close", `Harvest closes: ${w.name}`);
    }
  }

  const order: Record<ForecastCalendarEvent["type"], number> = {
    sow: 0,
    "harvest-start": 1,
    "harvest-open": 1,
    "harvest-ideal": 2,
    "harvest-end": 3,
    "harvest-close": 3,
  };
  out.sort(
    (a, b) => a.date.localeCompare(b.date) || order[a.type] - order[b.type] || a.name.localeCompare(b.name),
  );
  return out;
}
