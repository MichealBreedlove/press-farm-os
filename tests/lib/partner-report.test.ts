import { describe, it, expect } from "vitest";
import { yearRange, priorYearSpan, pctChange, buildMonthBars } from "@/lib/partner-report";

describe("yearRange", () => {
  it("covers the full calendar year once it has ended", () => {
    expect(yearRange(2025, "2026-01-02")).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
      label: "2025",
      partialThrough: null,
    });
  });

  it("clamps the current year to today and labels it as partial", () => {
    const r = yearRange(2026, "2026-09-27");
    expect(r.start).toBe("2026-01-01");
    expect(r.end).toBe("2026-09-27");
    expect(r.partialThrough).toBe("2026-09-27");
    expect(r.label).toBe("2026 (through Sep 27)");
  });

  it("treats Dec 31 of the year itself as complete", () => {
    expect(yearRange(2026, "2026-12-31").partialThrough).toBeNull();
  });
});

describe("priorYearSpan", () => {
  it("shifts both ends back one year", () => {
    expect(priorYearSpan({ start: "2026-01-01", end: "2026-09-27" })).toEqual({
      start: "2025-01-01",
      end: "2025-09-27",
    });
  });

  it("maps Feb 29 onto Feb 28 in a non-leap year", () => {
    expect(priorYearSpan({ start: "2028-01-01", end: "2028-02-29" }).end).toBe("2027-02-28");
  });
});

describe("pctChange", () => {
  it("computes growth and decline", () => {
    expect(pctChange(84965, 72158)).toBeCloseTo(17.75, 1);
    expect(pctChange(50, 100)).toBe(-50);
  });

  it("returns null without a baseline", () => {
    expect(pctChange(100, 0)).toBeNull();
  });
});

describe("buildMonthBars", () => {
  it("scales bars to the best month", () => {
    const bars = buildMonthBars(2025, { "2025-01": 200, "2025-06": 50 }, null);
    expect(bars).toHaveLength(12);
    expect(bars[0]).toMatchObject({ label: "Jan", value: 200, pct: 100, partial: false, future: false });
    expect(bars[5]).toMatchObject({ label: "Jun", value: 50, pct: 25 });
    expect(bars[11]).toMatchObject({ label: "Dec", value: 0, pct: 0, future: false });
  });

  it("marks the in-progress month and blanks later months on a partial year", () => {
    const bars = buildMonthBars(2026, { "2026-09": 100, "2026-10": 999 }, "2026-09-27");
    expect(bars[8]).toMatchObject({ label: "Sep", partial: true, future: false, value: 100 });
    expect(bars[9]).toMatchObject({ label: "Oct", future: true, value: 0 });
  });
});
