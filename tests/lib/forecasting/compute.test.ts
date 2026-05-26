import { describe, it, expect } from "vitest";
import {
  fieldCropWindows,
  microgreenWindows,
  microgreenWindowsInRange,
  availabilityBuckets,
  cropWindowsInRange,
  microgreenEventsInRange,
  NOW_MAX_DAYS,
} from "@/lib/forecasting/compute";
import type {
  ForecastData,
  ForecastMicrogreenBatchRow,
  ForecastMicrogreenCropRow,
  ForecastPlantingRow,
} from "@/lib/forecasting/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const REF = "2026-05-26"; // reference date used throughout

function planting(overrides: Partial<ForecastPlantingRow> = {}): ForecastPlantingRow {
  return {
    id: "p1",
    crop_name: "Tomatoes",
    variety: null,
    category: "fruit",
    item_id: null,
    sow_date: "2026-03-01",
    transplant_date: null,
    harvest_start: "2026-05-20",
    harvest_end: "2026-06-30",
    termination_date: null,
    days_to_maturity: 80,
    quantity: 40,
    quantity_unit: "plants",
    harvest_unit: "lbs",
    status: "growing",
    season: 2026,
    items: null,
    ...overrides,
  };
}

const peaCrop: ForecastMicrogreenCropRow = {
  id: "crop-pea",
  name: "Pea Shoots",
  variety: null,
  ideal_harvest_day: 12,
  harvest_min_days: 10,
  harvest_max_days: 14,
  is_continuous_harvest: false,
  productive_life_days: null,
  yield_per_tray: { lg: 4, sm: 8, ea: 32 },
};

// Continuous-harvest crop: window normally closes at max_days but productive
// life extends it.
const nastCrop: ForecastMicrogreenCropRow = {
  id: "crop-nast",
  name: "Nasturtium",
  variety: null,
  ideal_harvest_day: 20,
  harvest_min_days: 18,
  harvest_max_days: 22,
  is_continuous_harvest: true,
  productive_life_days: 45,
  yield_per_tray: { lg: 6 },
};

function batch(
  overrides: Partial<ForecastMicrogreenBatchRow> = {},
): ForecastMicrogreenBatchRow {
  return {
    id: "b1",
    crop_id: "crop-pea",
    sow_date: "2026-05-16",
    planned_blackout_end: "2026-05-22",
    planned_harvest_date: "2026-05-28",
    tray_count: 3,
    ...overrides,
  };
}

const crops = [peaCrop, nastCrop];

// ─── fieldCropWindows ────────────────────────────────────────────────────────

describe("fieldCropWindows", () => {
  it("includes a crop whose window overlaps the range", () => {
    const out = fieldCropWindows("2026-05-26", "2026-06-10", [planting()]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: "field",
      name: "Tomatoes",
      windowStart: "2026-05-20",
      windowEnd: "2026-06-30",
      unit: "lbs",
    });
  });

  it("excludes terminated plantings", () => {
    const out = fieldCropWindows("2026-05-26", "2026-06-10", [
      planting({ id: "p-term", status: "terminated" }),
    ]);
    expect(out).toEqual([]);
  });

  it("excludes cancelled plantings", () => {
    const out = fieldCropWindows("2026-05-26", "2026-06-10", [
      planting({ id: "p-cancel", status: "cancelled" }),
    ]);
    expect(out).toEqual([]);
  });

  it("excludes plantings whose window is entirely before the range", () => {
    const out = fieldCropWindows("2026-07-01", "2026-07-31", [planting()]);
    expect(out).toEqual([]);
  });

  it("excludes plantings with no harvest window", () => {
    const out = fieldCropWindows("2026-05-26", "2026-06-10", [
      planting({ harvest_start: null, harvest_end: null }),
    ]);
    expect(out).toEqual([]);
  });

  it("prefers the joined item name and unit_type over crop_name", () => {
    const out = fieldCropWindows("2026-05-26", "2026-06-10", [
      planting({
        crop_name: "raw-crop",
        harvest_unit: null,
        items: { name: "Heirloom Tomato", category: "fruit", unit_type: "ea" },
      }),
    ]);
    expect(out[0].name).toBe("Heirloom Tomato");
    expect(out[0].unit).toBe("ea");
  });
});

// ─── microgreenWindows ───────────────────────────────────────────────────────

describe("microgreenWindows", () => {
  it("computes window from sow_date + min/max days and ideal from planned_harvest_date", () => {
    const out = microgreenWindows([batch()], crops);
    expect(out).toHaveLength(1);
    const w = out[0];
    expect(w.seededOn).toBe("2026-05-16");
    expect(w.windowOpen).toBe("2026-05-26"); // 16 + 10
    expect(w.windowClose).toBe("2026-05-30"); // 16 + 14
    expect(w.readyOn).toBe("2026-05-28"); // planned_harvest_date
    expect(w.isContinuous).toBe(false);
    expect(w.trayCount).toBe(3);
  });

  it("estimates yield from yield_per_tray * tray_count", () => {
    const out = microgreenWindows([batch({ tray_count: 2 })], crops);
    // lg:4*2=8, sm:8*2=16, ea:32*2=64
    expect(out[0].estimate).toBe("8 LG / 16 SM / 64 EA");
  });

  it("falls back to sow_date + ideal_harvest_day when planned_harvest_date missing", () => {
    const out = microgreenWindows(
      [batch({ planned_harvest_date: "" as unknown as string })],
      crops,
    );
    expect(out[0].readyOn).toBe("2026-05-28"); // 16 + 12
  });

  it("extends windowClose to productive_life_days for continuous-harvest crops", () => {
    const out = microgreenWindows(
      [batch({ id: "b-nast", crop_id: "crop-nast", sow_date: "2026-05-01", planned_harvest_date: "2026-05-21", tray_count: 2 })],
      crops,
    );
    const w = out[0];
    expect(w.isContinuous).toBe(true);
    expect(w.windowOpen).toBe("2026-05-19"); // 01 + 18
    // max_days would close 05-23, but productive_life 45 days extends to 06-15
    expect(w.windowClose).toBe("2026-06-15"); // 01 + 45
  });

  it("resolves crop from the joined batch.crop when not in the crops list", () => {
    const out = microgreenWindows(
      [batch({ id: "b-joined", crop_id: "crop-pea", crop: peaCrop })],
      [], // empty crops list — must use joined crop
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Pea Shoots");
  });

  it("skips batches whose crop cannot be resolved", () => {
    const out = microgreenWindows([batch({ crop_id: "missing" })], []);
    expect(out).toEqual([]);
  });
});

describe("microgreenWindowsInRange", () => {
  it("filters to batches overlapping the range", () => {
    const inRange = batch({ id: "b-in", sow_date: "2026-05-16" }); // window 05-26..05-30
    const outRange = batch({ id: "b-out", sow_date: "2026-01-01" }); // window in Jan
    const out = microgreenWindowsInRange("2026-05-26", "2026-06-01", [inRange, outRange], crops);
    expect(out.map((w) => w.batchId)).toEqual(["b-in"]);
  });
});

// ─── availabilityBuckets ─────────────────────────────────────────────────────

describe("availabilityBuckets", () => {
  function data(overrides: Partial<ForecastData> = {}): ForecastData {
    return { plantings: [], batches: [], crops, ...overrides };
  }

  it("puts a crop in-window on the reference date in `now`", () => {
    // harvest_start 05-20 <= ref 05-26 <= harvest_end 06-30
    const buckets = availabilityBuckets(REF, data({ plantings: [planting()] }));
    expect(buckets.now.map((e) => e.name)).toContain("Tomatoes");
    expect(buckets.in2Weeks).toEqual([]);
    expect(buckets.referenceDate).toBe(REF);
  });

  it("does not double-count a now crop in a forward bucket", () => {
    const buckets = availabilityBuckets(REF, data({ plantings: [planting()] }));
    const allForward = [...buckets.in2Weeks, ...buckets.in4Weeks, ...buckets.in2Months];
    expect(allForward.find((e) => e.name === "Tomatoes")).toBeUndefined();
  });

  it("places a crop opening in ~2 weeks in `in2Weeks`", () => {
    // window opens ref + 16 days = 2026-06-11 (within 14–20 range)
    const p = planting({ id: "p2", crop_name: "Squash", harvest_start: "2026-06-11", harvest_end: "2026-07-15" });
    const buckets = availabilityBuckets(REF, data({ plantings: [p] }));
    expect(buckets.in2Weeks.map((e) => e.name)).toContain("Squash");
    expect(buckets.now.find((e) => e.name === "Squash")).toBeUndefined();
  });

  it("places a crop opening within NOW_MAX_DAYS into `now`", () => {
    // opens ref + 5 days, still closed on ref but imminent
    const opensSoon = new Date("2026-05-31T00:00:00Z").toISOString().slice(0, 10);
    const p = planting({ id: "p-soon", crop_name: "Beans", harvest_start: opensSoon, harvest_end: "2026-07-01" });
    const buckets = availabilityBuckets(REF, data({ plantings: [p] }));
    expect(buckets.now.map((e) => e.name)).toContain("Beans");
  });

  it("places a crop opening in ~4 weeks and ~2 months in their buckets", () => {
    const fourWk = planting({ id: "p4", crop_name: "Corn", harvest_start: "2026-06-25", harvest_end: "2026-08-01" }); // ref+30
    const twoMo = planting({ id: "p8", crop_name: "Pumpkin", harvest_start: "2026-07-20", harvest_end: "2026-09-01" }); // ref+55
    const buckets = availabilityBuckets(REF, data({ plantings: [fourWk, twoMo] }));
    expect(buckets.in4Weeks.map((e) => e.name)).toContain("Corn");
    expect(buckets.in2Months.map((e) => e.name)).toContain("Pumpkin");
  });

  it("includes a microgreen batch whose window is open now", () => {
    // pea batch sown 05-16: window 05-26..05-30 — open on ref 05-26
    const buckets = availabilityBuckets(REF, data({ batches: [batch()] }));
    const pea = buckets.now.find((e) => e.source === "microgreen");
    expect(pea?.name).toBe("Pea Shoots");
    expect(pea?.category).toBe("micro");
    expect(pea?.estimate).toBe("12 LG / 24 SM / 96 EA"); // 3 trays
  });

  it("excludes terminated plantings from all buckets", () => {
    const buckets = availabilityBuckets(REF, data({ plantings: [planting({ status: "terminated" })] }));
    expect(buckets.now).toEqual([]);
    expect(buckets.in2Weeks).toEqual([]);
  });

  it("NOW_MAX_DAYS boundary is honored", () => {
    expect(NOW_MAX_DAYS).toBe(13);
  });
});

// ─── calendar events ─────────────────────────────────────────────────────────

describe("cropWindowsInRange (field events)", () => {
  it("emits harvest-start and harvest-end events in range", () => {
    const data: ForecastData = { plantings: [planting()], batches: [], crops };
    const events = cropWindowsInRange("2026-05-01", "2026-07-31", data);
    expect(events.map((e) => e.type)).toEqual(["harvest-start", "harvest-end"]);
    expect(events[0]).toMatchObject({
      source: "field",
      type: "harvest-start",
      date: "2026-05-20",
      name: "Tomatoes",
    });
  });

  it("only emits endpoints that fall within the range", () => {
    const data: ForecastData = { plantings: [planting()], batches: [], crops };
    // range covers harvest_end (06-30) but not harvest_start (05-20)
    const events = cropWindowsInRange("2026-06-01", "2026-07-31", data);
    expect(events.map((e) => e.type)).toEqual(["harvest-end"]);
  });

  it("excludes terminated plantings", () => {
    const data: ForecastData = { plantings: [planting({ status: "terminated" })], batches: [], crops };
    expect(cropWindowsInRange("2026-05-01", "2026-07-31", data)).toEqual([]);
  });
});

describe("microgreenEventsInRange (microgreen events)", () => {
  it("emits sow / harvest-open / harvest-ideal / harvest-close", () => {
    const data: ForecastData = { plantings: [], batches: [batch()], crops };
    const events = microgreenEventsInRange("2026-05-01", "2026-06-30", data);
    const types = events.map((e) => e.type);
    expect(types).toEqual(["sow", "harvest-open", "harvest-ideal", "harvest-close"]);
    const sow = events.find((e) => e.type === "sow")!;
    expect(sow.date).toBe("2026-05-16");
    expect(sow.label).toBe("Sow 3× Pea Shoots");
    expect(events.find((e) => e.type === "harvest-ideal")!.date).toBe("2026-05-28");
  });

  it("suppresses harvest-open / harvest-close when they equal the ideal date", () => {
    // crop where min == max == ideal so open/close collapse onto ideal
    const flatCrop: ForecastMicrogreenCropRow = {
      ...peaCrop,
      id: "crop-flat",
      harvest_min_days: 12,
      harvest_max_days: 12,
      ideal_harvest_day: 12,
    };
    const b = batch({ id: "b-flat", crop_id: "crop-flat", planned_harvest_date: "2026-05-28" }); // 16+12
    const data: ForecastData = { plantings: [], batches: [b], crops: [flatCrop] };
    const events = microgreenEventsInRange("2026-05-01", "2026-06-30", data);
    expect(events.map((e) => e.type)).toEqual(["sow", "harvest-ideal"]);
  });

  it("only emits events that fall within the range", () => {
    const data: ForecastData = { plantings: [], batches: [batch()], crops };
    // range only covers the harvest window, not the sow date
    const events = microgreenEventsInRange("2026-05-25", "2026-05-31", data);
    expect(events.map((e) => e.type)).not.toContain("sow");
    expect(events.map((e) => e.type)).toContain("harvest-ideal");
  });
});
