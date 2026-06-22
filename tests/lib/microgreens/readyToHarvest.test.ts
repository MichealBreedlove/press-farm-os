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

describe("computeReadyToHarvest", () => {
  it("shows only trays a grower has marked ready (status 'harvesting')", () => {
    const trays = [
      baseTray({ id: "t1", status: "light" }),    // past ideal day, but not confirmed
      baseTray({ id: "t2", status: "blackout" }),  // not confirmed
    ];
    const result = computeReadyToHarvest({
      crops: [baseCrop], batches: [baseBatch({})], trays,
    });
    expect(result).toEqual([]);
  });

  it("groups harvesting trays by crop with counts and yield totals", () => {
    const trays = [
      baseTray({ id: "t1", status: "harvesting" }),
      baseTray({ id: "t2", status: "harvesting" }),
      baseTray({ id: "t3", status: "light" }), // not marked ready -> excluded
    ];
    const result = computeReadyToHarvest({
      crops: [baseCrop], batches: [baseBatch({})], trays,
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
      baseTray({ id: "t1", batch_id: "b1", status: "harvesting" }),
      baseTray({ id: "t2", batch_id: "b2", status: "harvesting" }),
    ];
    const result = computeReadyToHarvest({
      crops: [baseCrop, cropB], batches, trays,
    });
    // sorted by name: Broccoli before Pea
    expect(result.map((r) => r.name)).toEqual(["Broccoli", "Pea"]);
    expect(result[1].yieldEstimate).toBeNull(); // empty yield map
  });

  it("ignores harvesting trays whose batch or crop is missing", () => {
    const trays = [baseTray({ id: "t1", batch_id: "orphan", status: "harvesting" })];
    const result = computeReadyToHarvest({
      crops: [baseCrop], batches: [baseBatch({})], trays,
    });
    expect(result).toEqual([]);
  });

  it("excludes terminated and lost trays", () => {
    const trays = [
      baseTray({ id: "t1", status: "terminated" }),
      baseTray({ id: "t2", status: "lost" }),
    ];
    const result = computeReadyToHarvest({
      crops: [baseCrop], batches: [baseBatch({})], trays,
    });
    expect(result).toEqual([]);
  });
});
