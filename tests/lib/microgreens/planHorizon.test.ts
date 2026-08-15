import { describe, it, expect } from "vitest";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import { PLAN_HORIZON_DAYS } from "@/lib/microgreens/constants";

/**
 * Regression guard for the long-lead-crop trap.
 *
 * If PLAN_HORIZON_DAYS is shorter than a crop's ideal_harvest_day, that crop's
 * delivery dates only enter the planning window AFTER their sow date has
 * already passed. Every run then emits a fresh *overdue* sow task, the operator
 * can never clear it, and there is no point at which the app tells them to sow
 * in time. This bit Shiso (29d), Fennel (23d) and Chervil (22d) under the
 * original 21-day horizon.
 */

function crop(over: Record<string, unknown> = {}) {
  return {
    id: "crop-long-lead",
    name: "Shiso",
    variety: "Purple",
    is_active: true,
    presoak_hours: 0,
    presprout_hours: 0,
    blackout_days: 5,
    ideal_harvest_day: 29,
    keep_in_blackout: false,
    is_continuous_harvest: false,
    yield_per_tray: { lg: 1 },
    item_id: null,
    ...over,
  } as never;
}

function demand(over: Record<string, unknown> = {}) {
  return {
    id: "demand-1",
    crop_id: "crop-long-lead",
    restaurant_id: null,
    day_of_week: 1, // Monday
    target_quantity: 2,
    target_unit: "lg",
    interval_weeks: 1,
    effective_from: null,
    effective_to: null,
    ...over,
  } as never;
}

/** Mondays far enough out that a 29-day crop is plannable from 2026-08-16. */
const MONDAYS = ["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"];

function planAt(nowIso: string, horizonDays: number) {
  const now = new Date(`${nowIso}T09:00:00Z`);
  const horizon = new Date(now.getTime() + horizonDays * 864e5).toISOString().slice(0, 10);
  return computeSowPlan({
    crops: [crop()],
    demand: [demand()],
    batches: [],
    trays: [],
    deliveryDates: MONDAYS.filter((d) => d >= nowIso && d <= horizon),
    now,
  });
}

describe("plan horizon vs. long-lead crops", () => {
  it("PLAN_HORIZON_DAYS covers the longest lead time in the catalog with demand", () => {
    // Shiso Purple, at 29 days, is the longest-lead crop currently carrying
    // demand. Anything at or under the horizon can be planned on time.
    expect(PLAN_HORIZON_DAYS).toBeGreaterThan(29);
  });

  it("surfaces a 29-day crop as an on-time sow, not a permanent overdue", () => {
    // 2026-09-14 delivery needs sowing on 2026-08-16 — the plan must offer it
    // that day rather than only revealing it once it's already late.
    const plan = planAt("2026-08-16", PLAN_HORIZON_DAYS);

    const onTime = plan.sow_today.find((t) => t.delivery_date === "2026-09-14");
    expect(onTime).toBeDefined();
    expect(onTime?.sow_date).toBe("2026-08-16");
    expect(plan.overdue.sow.some((t) => t.delivery_date === "2026-09-14")).toBe(false);
  });

  it("a horizon shorter than the lead time makes the same task permanently late", () => {
    // Documents the old behaviour so a future shortening of the constant fails
    // loudly here instead of silently re-breaking the board.
    const plan = planAt("2026-08-16", 21);

    expect(plan.sow_today).toHaveLength(0);
    expect(plan.overdue.sow.length).toBeGreaterThan(0);
    expect(plan.overdue.sow.every((t) => t.sow_date < "2026-08-16")).toBe(true);
  });
});
