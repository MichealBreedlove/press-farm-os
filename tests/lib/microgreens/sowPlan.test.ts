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
  expected_yield_oz_per_tray: 8,
  is_continuous_harvest: false, productive_life_days: null,
  growing_medium: ["soil"], preferred_medium: "soil",
  tray_size: "10x20", notes: null, is_active: true,
  created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
};

const today = new Date("2026-05-17T00:00:00Z"); // a Sunday

describe("computeSowPlan", () => {
  it("returns empty buckets when no demand", () => {
    const plan = computeSowPlan({
      crops: [broccoli],
      demand: [],
      batches: [],
      trays: [],
      deliveryDates: ["2026-05-30"],
      historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today).toEqual([]);
    expect(plan.harvest_today).toEqual([]);
  });

  it("schedules a sow today when delivery_date - ideal_harvest_day == today", () => {
    const delivery = "2026-05-27"; // 10 days out from today
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: "rest-press",
      day_of_week: 3, // Wednesday
      target_oz: 16,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const plan = computeSowPlan({
      crops: [broccoli],
      demand,
      batches: [],
      trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today).toHaveLength(1);
    expect(plan.sow_today[0].trays_to_sow).toBe(2); // ceil(16 / 8)
    expect(plan.sow_today[0].delivery_date).toBe(delivery);
  });

  it("subtracts in-flight trays from trays_to_sow", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: 3, target_oz: 16,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
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
      deliveryDates: [delivery], historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today[0].trays_to_sow).toBe(1); // needed 2 - inflight 1
    expect(plan.sow_today[0].trays_in_flight).toBe(1);
  });

  it("excludes terminated/lost trays from in-flight count", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: 3, target_oz: 16,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
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
      historicalDeliveryItems: [], now: today,
    });
    expect(plan.sow_today[0].trays_in_flight).toBe(1); // only t2 counts
    expect(plan.sow_today[0].trays_to_sow).toBe(1);    // 2 needed - 1 in flight
  });

  it("aggregates demand across restaurants for same day-of-week", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [
      {
        id: "d1", crop_id: broccoli.id, restaurant_id: "rest-press",
        day_of_week: 3, target_oz: 8,
        effective_from: null, effective_to: null, notes: null,
        created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "d2", crop_id: broccoli.id, restaurant_id: "rest-under",
        day_of_week: 3, target_oz: 8,
        effective_from: null, effective_to: null, notes: null,
        created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
      },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery], historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today[0].expected_oz).toBe(16);
    expect(plan.sow_today[0].trays_to_sow).toBe(2);
  });

  it("flags a warning when forecast exceeds manual by 25%", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: 3, target_oz: 8,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const history = [
      { delivery_date: "2026-05-13", quantity_oz: 12, item_id: "item-broccoli" },
      { delivery_date: "2026-05-06", quantity_oz: 12, item_id: "item-broccoli" },
      { delivery_date: "2026-04-29", quantity_oz: 12, item_id: "item-broccoli" },
      { delivery_date: "2026-04-22", quantity_oz: 12, item_id: "item-broccoli" },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: history,
      now: today,
    });
    const task = plan.sow_today[0];
    expect(task.manual_oz).toBe(8);
    expect(task.forecast_oz).toBe(12);
    expect(task.is_warning).toBe(true);
    expect(plan.warnings).toHaveLength(1);
  });

  it("uses forecast as fallback when no manual demand is set", () => {
    const delivery = "2026-05-27";
    const history = [
      { delivery_date: "2026-05-13", quantity_oz: 16, item_id: "item-broccoli" },
      { delivery_date: "2026-05-06", quantity_oz: 16, item_id: "item-broccoli" },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand: [], batches: [], trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: history,
      now: today,
    });
    expect(plan.sow_today).toHaveLength(1);
    expect(plan.sow_today[0].expected_oz).toBe(16);
    expect(plan.sow_today[0].is_warning).toBe(false); // no manual to compare against
  });

  it("places past-due sow tasks in overdue.sow", () => {
    const delivery = "2026-05-22"; // 5 days out -> sow_date 2026-05-12 (5 days ago)
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: new Date(delivery + "T00:00:00Z").getUTCDay(),
      target_oz: 8,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: [], now: today,
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
      deliveryDates: [], historicalDeliveryItems: [], now: today,
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
      deliveryDates: [], historicalDeliveryItems: [], now: today,
    });
    expect(plan.harvest_today).toHaveLength(1);
    expect(plan.harvest_today[0].kind).toBe("single-cut");
  });
});
