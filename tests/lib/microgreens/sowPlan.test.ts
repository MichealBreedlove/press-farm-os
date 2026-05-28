import { describe, it, expect } from "vitest";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import type {
  MicrogreenCrop, MicrogreenDemand, MicrogreenBatch, MicrogreenTray,
} from "@/types/database";

const broccoli: MicrogreenCrop = {
  id: "crop-broccoli", farm_id: "f1", item_id: "item-broccoli",
  name: "Broccoli", variety: null,
  seed_density_g_per_tray: 22,
  presoak_hours: 0, presprout_hours: 0,
  bury_seed: false, weight_during_blackout: false,
  blackout_days: 3, keep_in_blackout: false,
  ideal_harvest_day: 10, harvest_min_days: 8, harvest_max_days: 12,
  harvest_stage: "baby_green",
  expected_yield_oz_per_tray: 8,
  // Migration 047 unit-based yield. 1 tray = 8 LG or 16 SM.
  // EA intentionally omitted so the missing_yield_config test has a unit to trigger on.
  yield_per_tray: { lg: 8, sm: 16 },
  is_continuous_harvest: false, productive_life_days: null,
  growing_medium: ["soil"], preferred_medium: "soil",
  tray_size: "10x20", notes: null, is_active: true,
  created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
};

const today = new Date("2026-05-17T00:00:00Z"); // a Sunday

function makeDemand(
  id: string,
  overrides: Partial<MicrogreenDemand> = {},
): MicrogreenDemand {
  return {
    id,
    crop_id: broccoli.id,
    restaurant_id: null,
    day_of_week: 3,
    target_oz: 0,
    target_quantity: 8,
    target_unit: "lg",
    effective_from: null,
    effective_to: null,
    notes: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeSowPlan", () => {
  it("returns empty buckets when no demand", () => {
    const plan = computeSowPlan({
      crops: [broccoli],
      demand: [],
      batches: [],
      trays: [],
      deliveryDates: ["2026-05-30"],
      now: today,
    });
    expect(plan.sow_today).toEqual([]);
    expect(plan.harvest_today).toEqual([]);
  });

  it("schedules a sow today when delivery_date - ideal_harvest_day == today", () => {
    const delivery = "2026-05-27"; // 10 days out from today
    const demand: MicrogreenDemand[] = [
      makeDemand("d1", { restaurant_id: "rest-press", target_quantity: 16, target_unit: "lg" }),
    ];
    const plan = computeSowPlan({
      crops: [broccoli],
      demand,
      batches: [],
      trays: [],
      deliveryDates: [delivery],
      now: today,
    });
    expect(plan.sow_today).toHaveLength(1);
    expect(plan.sow_today[0].trays_to_sow).toBe(2); // ceil(16 LG / 8 LG-per-tray)
    expect(plan.sow_today[0].delivery_date).toBe(delivery);
    expect(plan.sow_today[0].expected_demands).toEqual([{ unit: "lg", quantity: 16 }]);
  });

  it("subtracts in-flight trays from trays_to_sow", () => {
    const delivery = "2026-05-27";
    const demand = [makeDemand("d1", { target_quantity: 16, target_unit: "lg" })];
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-17",
      soak_started_at: null, planned_blackout_end: "2026-05-20",
      planned_harvest_date: delivery, tray_count: 1,
      seed_lot: null, notes: null,
      created_at: "2026-05-17T00:00:00Z",
    };
    const tray: MicrogreenTray = {
      id: "t1", batch_id: "b1", tray_label: "BR-0517-01",
      status: "blackout", sow_date: "2026-05-17",
      blackout_start: "2026-05-17", light_start: null,
      harvesting_start: null, terminated_at: null,
      lost_reason: null, location: null, notes: null,
      created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
    };
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [batch], trays: [tray],
      deliveryDates: [delivery],
      now: today,
    });
    expect(plan.sow_today[0].trays_to_sow).toBe(1); // needed 2 - inflight 1
    expect(plan.sow_today[0].trays_in_flight).toBe(1);
  });

  it("excludes terminated/lost trays from in-flight count", () => {
    const delivery = "2026-05-27";
    const demand = [makeDemand("d1", { target_quantity: 16, target_unit: "lg" })];
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-17",
      soak_started_at: null, planned_blackout_end: "2026-05-20",
      planned_harvest_date: delivery, tray_count: 2,
      seed_lot: null, notes: null,
      created_at: "2026-05-17T00:00:00Z",
    };
    const trays: MicrogreenTray[] = [
      {
        id: "t1", batch_id: "b1", tray_label: "BR-0517-01",
        status: "lost", sow_date: "2026-05-17",
        blackout_start: "2026-05-17", light_start: null,
        harvesting_start: null, terminated_at: null,
        lost_reason: "mold", location: null, notes: null,
        created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
      },
      {
        id: "t2", batch_id: "b1", tray_label: "BR-0517-02",
        status: "blackout", sow_date: "2026-05-17",
        blackout_start: "2026-05-17", light_start: null,
        harvesting_start: null, terminated_at: null,
        lost_reason: null, location: null, notes: null,
        created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
      },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [batch], trays, deliveryDates: [delivery],
      now: today,
    });
    expect(plan.sow_today[0].trays_in_flight).toBe(1); // only t2 counts
    expect(plan.sow_today[0].trays_to_sow).toBe(1);    // 2 needed - 1 in flight
  });

  it("aggregates demand across restaurants for same day-of-week + unit", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [
      makeDemand("d1", { restaurant_id: "rest-press", target_quantity: 8, target_unit: "lg" }),
      makeDemand("d2", { restaurant_id: "rest-under", target_quantity: 8, target_unit: "lg" }),
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery],
      now: today,
    });
    expect(plan.sow_today[0].expected_demands).toEqual([{ unit: "lg", quantity: 16 }]);
    expect(plan.sow_today[0].trays_to_sow).toBe(2);
  });

  it("sums tray-equivalents across mixed units (alternatives model)", () => {
    const delivery = "2026-05-27";
    // 4 LG + 8 SM. 1 tray = 8 LG = 16 SM.
    // tray-equivalents = 4/8 + 8/16 = 0.5 + 0.5 = 1.0 → ceil → 1 tray.
    const demand: MicrogreenDemand[] = [
      makeDemand("d1", { target_quantity: 4, target_unit: "lg" }),
      makeDemand("d2", { target_quantity: 8, target_unit: "sm" }),
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery], now: today,
    });
    expect(plan.sow_today[0].trays_to_sow).toBe(1);
    expect(plan.sow_today[0].expected_demands).toEqual(
      expect.arrayContaining([
        { unit: "lg", quantity: 4 },
        { unit: "sm", quantity: 8 },
      ]),
    );
  });

  it("flags missing_yield_config when a demand unit isn't in yield_per_tray", () => {
    const delivery = "2026-05-27";
    // ea isn't in broccoli's yield_per_tray map (fixture only has lg + sm)
    const demand = [makeDemand("d1", { target_quantity: 1, target_unit: "ea" })];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery], now: today,
    });
    expect(plan.sow_today[0].missing_yield_config).toBe(true);
    // Fallback contributes 1 tray-equivalent to keep task visible.
    expect(plan.sow_today[0].trays_to_sow).toBe(1);
    expect(plan.warnings).toHaveLength(1);
  });

  it("ignores demand rows with no target_quantity or unit (deprecated oz-only rows)", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [
      // Old-style row: target_oz set but no target_quantity/unit.
      // The new planner ignores these (they can't be converted to trays).
      makeDemand("d1", { target_oz: 16, target_quantity: null, target_unit: null }),
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery], now: today,
    });
    expect(plan.sow_today).toEqual([]);
  });

  it("places past-due sow tasks in overdue.sow", () => {
    const delivery = "2026-05-22"; // 5 days out -> sow_date 2026-05-12 (5 days ago)
    const dow = new Date(delivery + "T00:00:00Z").getUTCDay();
    const demand = [
      makeDemand("d1", { day_of_week: dow, target_quantity: 8, target_unit: "lg" }),
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery],
      now: today,
    });
    expect(plan.sow_today).toHaveLength(0);
    expect(plan.overdue.sow).toHaveLength(1);
  });

  it("populates advance_today when blackout completes today", () => {
    const tray: MicrogreenTray = {
      id: "t1", batch_id: "b1", tray_label: "BR-0514-01",
      status: "blackout", sow_date: "2026-05-14",   // 3 days ago
      blackout_start: "2026-05-14", light_start: null,
      harvesting_start: null, terminated_at: null,
      lost_reason: null, location: null, notes: null,
      created_at: "2026-05-14T00:00:00Z", updated_at: "2026-05-14T00:00:00Z",
    };
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-14",
      soak_started_at: null, planned_blackout_end: "2026-05-17",
      planned_harvest_date: "2026-05-24", tray_count: 1,
      seed_lot: null, notes: null,
      created_at: "2026-05-14T00:00:00Z",
    };
    const plan = computeSowPlan({
      crops: [broccoli], demand: [], batches: [batch], trays: [tray],
      deliveryDates: [],
      now: today,
    });
    expect(plan.advance_today).toHaveLength(1);
    expect(plan.advance_today[0].from_status).toBe("blackout");
    expect(plan.advance_today[0].to_status).toBe("light");
  });

  it("populates harvest_today for single-cut tray at ideal_harvest_day", () => {
    const tray: MicrogreenTray = {
      id: "t1", batch_id: "b1", tray_label: "BR-0507-01",
      status: "light",
      sow_date: "2026-05-07", // 10 days ago, ideal_harvest_day = 10
      blackout_start: "2026-05-07", light_start: "2026-05-10",
      harvesting_start: null, terminated_at: null,
      lost_reason: null, location: null, notes: null,
      created_at: "2026-05-07T00:00:00Z", updated_at: "2026-05-07T00:00:00Z",
    };
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-07",
      soak_started_at: null, planned_blackout_end: "2026-05-10",
      planned_harvest_date: "2026-05-17", tray_count: 1,
      seed_lot: null, notes: null,
      created_at: "2026-05-07T00:00:00Z",
    };
    const plan = computeSowPlan({
      crops: [broccoli], demand: [], batches: [batch], trays: [tray],
      deliveryDates: [],
      now: today,
    });
    expect(plan.harvest_today).toHaveLength(1);
    expect(plan.harvest_today[0].kind).toBe("single-cut");
  });
});
