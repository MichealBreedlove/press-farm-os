import { describe, it, expect } from "vitest";
import { computeRecurringSowDates } from "@/lib/tasks/regenerate-recurring";

describe("computeRecurringSowDates", () => {
  const TODAY = "2026-05-27";

  it("returns empty for zero or negative interval", () => {
    expect(computeRecurringSowDates("2026-05-01", 0, TODAY)).toEqual([]);
    expect(computeRecurringSowDates("2026-05-01", -7, TODAY)).toEqual([]);
  });

  it("fast-forwards past stale anchors", () => {
    // Anchor 30 days ago, interval 14d. First valid next sow = anchor + 14d
    // = 2026-05-11 (still in past). Skip forward to 2026-05-25 → also past.
    // Next: 2026-06-08.
    const dates = computeRecurringSowDates("2026-04-27", 14, TODAY);
    expect(dates[0]).toBe("2026-06-08");
  });

  it("starts from today when there is no anchor", () => {
    const dates = computeRecurringSowDates(null, 7, TODAY);
    expect(dates[0]).toBe(TODAY);
  });

  it("generates exactly the horizon window", () => {
    // interval=7d, horizon=30d → up to ~4 dates after fast-forwarding.
    const dates = computeRecurringSowDates(null, 7, TODAY, 30);
    expect(dates.length).toBeGreaterThanOrEqual(4);
    expect(dates.length).toBeLessThanOrEqual(5);
    // All dates within horizon.
    for (const d of dates) {
      expect(d >= TODAY).toBe(true);
      expect(d <= "2026-06-26").toBe(true);
    }
  });

  it("respects a near-future anchor (anchor + interval falls within horizon)", () => {
    // Anchor 3 days ago, interval 14d. First sow = 2026-06-07.
    const dates = computeRecurringSowDates("2026-05-24", 14, TODAY, 30);
    expect(dates).toEqual(["2026-06-07", "2026-06-21"]);
  });

  it("produces strictly increasing dates", () => {
    const dates = computeRecurringSowDates(null, 7, TODAY, 60);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it("handles a future anchor by using anchor + interval directly", () => {
    // Anchor is 5 days in the future, interval 7d.
    // Per current semantics: next = anchor + interval. We don't generate the
    // anchor itself (that's the last KNOWN sow, not the next).
    const dates = computeRecurringSowDates("2026-06-01", 7, TODAY, 30);
    expect(dates[0]).toBe("2026-06-08");
  });
});
