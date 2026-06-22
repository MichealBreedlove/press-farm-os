import { describe, it, expect } from "vitest";
import { computeReadyToHarvest } from "@/lib/microgreens/readyToHarvest";
import type { MicrogreenCrop, MicrogreenTray, MicrogreenBatch } from "@/types/database";

const baseCrop: MicrogreenCrop = {
  id: "c1", farm_id: "f1", item_id: null,
  name: "Broccoli", variety: null,
  seed_density_g_per_tray: 22,
  presoak_hours: 0, presprout_hours: 0,
  bury_seed: false, weight_during_blackout: false,
  blackout_days: 3, keep_in_blackout: false,
  ideal_harvest_day: 10, harvest_min_days: 8, harvest_max_days: 12,
  harvest_stage: "baby_green",
  expected_yield_oz_per_tray: 8,
  yield_per_tray: { lg: 4, sm: 8 },
  is_continuous_harvest: false, productive_life_days: null,
  growing_medium: ["soil"], preferred_medium: "soil",
  tray_size: "10x20", notes: null, is_active: true,
  created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
};

const baseBatch = (overrides: Partial<MicrogreenBatch>): MicrogreenBatch => ({
  id: "b1", crop_id: "c1", sow_date: "2026-05-07",
  soak_started_at: null, planned_blackout_end: null,
  planned_harvest_date: "2026-05-17", tray_count: 1,
  seed_lot: null, notes: null,
  created_at: "2026-05-07T00:00:00Z",
  ...overrides,
});

const baseTray = (overrides: Partial<MicrogreenTray>): MicrogreenTray => ({
  id: "t1", batch_id: "b1", tray_label: "BR-0507-01",
  status: "light", sow_date: "2026-05-07",
  blackout_start: "2026-05-07", light_start: "2026-05-10",
  harvesting_start: null, terminated_at: null,
  lost_reason: null, location: null, notes: null,
  created_at: "2026-05-07T00:00:00Z", updated_at: "2026-05-07T00:00:00Z",
  ...overrides,
});

const NOW = new Date("2026-05-17T08:00:00Z"); // sow + 10 days = ideal harvest day

describe("computeReadyToHarvest", () => {
  it("returns nothing when no trays are ready", () => {
    const trays = [baseTray({ id: "t1", sow_date: "2026-05-15" })]; // too young
    const result = computeReadyToHarvest({
      crops: [baseCrop], batches: [baseBatch({})], trays, now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("groups ready trays by crop with counts and yield totals", () => {
    const trays = [
      baseTray({ id: "t1" }),
      baseTray({ id: "t2" }),
      baseTray({ id: "t3", sow_date: "2026-05-16", status: "light" }), // not ready
    ];
    const result = computeReadyToHarvest({
      crops: [baseCrop], batches: [baseBatch({})], trays, now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cropId: "c1",
      name: "Broccoli",
      trayCount: 2,
      harvestStage: "baby_green",
      yieldEstimate: "8 LG / 16 SM", // 4*2 LG / 8*2 SM
    });
  });

  it("resolves trays to crops via their batch", () => {
    const cropB: MicrogreenCrop = { ...baseCrop, id: "c2", name: "Pea", yield_per_tray: {} };
    const batches = [
      baseBatch({ id: "b1", crop_id: "c1" }),
      baseBatch({ id: "b2", crop_id: "c2" }),
    ];
    const trays = [
      baseTray({ id: "t1", batch_id: "b1" }),
      baseTray({ id: "t2", batch_id: "b2" }),
    ];
    const result = computeReadyToHarvest({
      crops: [baseCrop, cropB], batches, trays, now: NOW,
    });
    // sorted by name: Broccoli before Pea
    expect(result.map((r) => r.name)).toEqual(["Broccoli", "Pea"]);
    expect(result[1].yieldEstimate).toBeNull(); // empty yield map
  });

  it("ignores trays whose batch or crop is missing", () => {
    const trays = [baseTray({ id: "t1", batch_id: "orphan" })];
    const result = computeReadyToHarvest({
      crops: [baseCrop], batches: [baseBatch({})], trays, now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("includes continuous-harvest trays in the harvesting stage", () => {
    const crop: MicrogreenCrop = {
      ...baseCrop, is_continuous_harvest: true, productive_life_days: 30,
    };
    const trays = [baseTray({ id: "t1", status: "harvesting" })];
    const result = computeReadyToHarvest({
      crops: [crop], batches: [baseBatch({})], trays, now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].trayCount).toBe(1);
  });
});
