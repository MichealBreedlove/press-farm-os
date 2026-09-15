import { describe, it, expect } from "vitest";
import { parsePeriod, resolvePeriod } from "@/lib/orders-explorer";

// 2026-09-16 is a Wednesday.
const TODAY = "2026-09-16";

describe("resolvePeriod", () => {
  it("weeks run Monday to Sunday", () => {
    expect(resolvePeriod("this_week", undefined, undefined, TODAY)).toEqual({ from: "2026-09-14", to: "2026-09-20" });
    expect(resolvePeriod("last_week", undefined, undefined, TODAY)).toEqual({ from: "2026-09-07", to: "2026-09-13" });
  });

  it("months and years are calendar-bounded", () => {
    expect(resolvePeriod("this_month", undefined, undefined, TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod("last_month", undefined, undefined, TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(resolvePeriod("this_year", undefined, undefined, TODAY)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(resolvePeriod("last_year", undefined, undefined, TODAY)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("last_month crosses the year boundary in January", () => {
    expect(resolvePeriod("last_month", undefined, undefined, "2026-01-10")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("custom swaps a reversed range and falls back to this month on bad input", () => {
    expect(resolvePeriod("custom", "2026-09-20", "2026-09-05", TODAY)).toEqual({ from: "2026-09-05", to: "2026-09-20" });
    expect(resolvePeriod("custom", "nope", undefined, TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});

describe("parsePeriod", () => {
  it("accepts known keys and defaults to this_month", () => {
    expect(parsePeriod("last_year")).toBe("last_year");
    expect(parsePeriod("custom")).toBe("custom");
    expect(parsePeriod("bogus")).toBe("this_month");
    expect(parsePeriod(undefined)).toBe("this_month");
  });
});
