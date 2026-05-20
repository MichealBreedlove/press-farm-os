import { describe, it, expect } from "vitest";
import {
  initialStatusForCrop,
  nextStatus,
  isReadyToAdvance,
  isReadyToHarvest,
} from "@/lib/microgreens/stages";
import type { MicrogreenCrop, MicrogreenTray } from "@/types/database";

const baseCrop: MicrogreenCrop = {
  id: "c1", farm_id: "f1", item_id: null,
  name: "Broccoli", variety: null,
  seed_density_g_per_tray: 22,
  presoak_hours: 0, presprout_hours: 0,
  bury_seed: false, weight_during_blackout: false,
  blackout_days: 3, keep_in_blackout: false,
  ideal_harvest_day: 10, harvest_min_days: 8, harvest_max_days: 12,
  expected_yield_oz_per_tray: 8,
  is_continuous_harvest: false, productive_life_days: null,
  growing_medium: ["soil"], preferred_medium: "soil",
  tray_size: "10x20", notes: null, is_active: true,
  created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
};

const baseTray = (overrides: Partial<MicrogreenTray>): MicrogreenTray => ({
  id: "t1", batch_id: "b1", tray_label: "BR-0517-01",
  status: "blackout", sow_date: "2026-05-17",
  blackout_start: "2026-05-17", light_start: null,
  harvesting_start: null, terminated_at: null,
  lost_reason: null, location: null, notes: null,
  created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
  ...overrides,
});

describe("initialStatusForCrop", () => {
  it("starts in soaking when presoak > 0", () => {
    expect(initialStatusForCrop({ ...baseCrop, presoak_hours: 6 })).toBe("soaking");
  });

  it("starts in soaking when presprout > 0", () => {
    expect(initialStatusForCrop({ ...baseCrop, presprout_hours: 12 })).toBe("soaking");
  });

  it("starts in blackout when no soak phase", () => {
    expect(initialStatusForCrop(baseCrop)).toBe("blackout");
  });
});

describe("nextStatus", () => {
  it("soaking -> blackout", () => {
    expect(nextStatus(baseCrop, "soaking")).toBe("blackout");
  });

  it("blackout -> light for normal crops", () => {
    expect(nextStatus(baseCrop, "blackout")).toBe("light");
  });

  it("blackout -> harvesting for keep_in_blackout crops", () => {
    expect(nextStatus({ ...baseCrop, keep_in_blackout: true }, "blackout")).toBe("harvesting");
  });

  it("light -> harvesting", () => {
    expect(nextStatus(baseCrop, "light")).toBe("harvesting");
  });

  it("harvesting -> terminated", () => {
    expect(nextStatus(baseCrop, "harvesting")).toBe("terminated");
  });
});

describe("isReadyToAdvance", () => {
  it("ready to advance from soaking when presoak+presprout hours have elapsed", () => {
    const crop = { ...baseCrop, presoak_hours: 6, presprout_hours: 12 };
    const tray = baseTray({
      status: "soaking",
      created_at: "2026-05-16T00:00:00Z", // 24h ago
    });
    expect(isReadyToAdvance(tray, crop, new Date("2026-05-17T00:00:00Z"))).toBe(true);
  });

  it("not ready from soaking when too soon", () => {
    const crop = { ...baseCrop, presoak_hours: 24, presprout_hours: 0 };
    const tray = baseTray({
      status: "soaking",
      created_at: "2026-05-17T00:00:00Z", // just now
    });
    expect(isReadyToAdvance(tray, crop, new Date("2026-05-17T06:00:00Z"))).toBe(false);
  });

  it("ready to advance from blackout when blackout_days have passed since sow_date", () => {
    const tray = baseTray({
      status: "blackout",
      sow_date: "2026-05-14",  // 3 days ago
      blackout_start: "2026-05-14",
    });
    expect(isReadyToAdvance(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(true);
  });

  it("not ready from blackout when too soon", () => {
    const tray = baseTray({
      status: "blackout",
      sow_date: "2026-05-16",  // 1 day ago
      blackout_start: "2026-05-16",
    });
    expect(isReadyToAdvance(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(false);
  });

  it("never ready to advance from light (light -> harvesting is a harvest event)", () => {
    const tray = baseTray({ status: "light" });
    expect(isReadyToAdvance(tray, baseCrop, new Date())).toBe(false);
  });
});

describe("isReadyToHarvest", () => {
  it("ready to harvest single-cut crop when sow_date + ideal_harvest_day == today", () => {
    const tray = baseTray({ sow_date: "2026-05-07", status: "light" });
    expect(isReadyToHarvest(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(true);
  });

  it("not ready when today is before ideal harvest day", () => {
    const tray = baseTray({ sow_date: "2026-05-15", status: "light" });
    expect(isReadyToHarvest(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(false);
  });

  it("continuous-harvest crop is ready whenever status is harvesting", () => {
    const crop = { ...baseCrop, is_continuous_harvest: true, productive_life_days: 30 };
    const tray = baseTray({ status: "harvesting" });
    expect(isReadyToHarvest(tray, crop, new Date("2026-05-17T08:00:00Z"))).toBe(true);
  });
});
