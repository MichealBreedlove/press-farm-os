import { describe, it, expect } from "vitest";
import { farmerPayForRange, quarterKey, type FarmerPayRate } from "@/lib/farmer-pay";

const RATES: FarmerPayRate[] = [
  { effective_date: "2020-01-01", hourly_rate: null, hours_per_week: null, flat_quarterly: "12000.00" },
  { effective_date: "2026-05-24", hourly_rate: "30.00", hours_per_week: "40.0", flat_quarterly: null },
];

describe("quarterKey", () => {
  it("maps dates to quarters", () => {
    expect(quarterKey("2026-01-01")).toBe("2026-Q1");
    expect(quarterKey("2026-05-23")).toBe("2026-Q2");
    expect(quarterKey("2026-12-31")).toBe("2026-Q4");
  });
});

describe("farmerPayForRange", () => {
  it("charges the flat rate for a full active quarter", () => {
    expect(farmerPayForRange(RATES, "2025-01-01", "2025-03-31", new Set(["2025-Q1"]))).toBeCloseTo(12000, 2);
  });

  it("skips inactive quarters under the flat rate", () => {
    const all = new Set(["2024-Q3", "2024-Q4"]);
    expect(farmerPayForRange(RATES, "2024-01-01", "2024-12-31", all)).toBeCloseTo(24000, 2);
  });

  it("prorates the switch to hourly mid-quarter", () => {
    // Apr 1 – May 23 = 53 of Q2's 91 days at $12K; May 24 – Jun 30 = 38 days at $1,200/wk.
    const pay = farmerPayForRange(RATES, "2026-04-01", "2026-06-30", new Set(["2026-Q2"]));
    expect(pay).toBeCloseTo((12000 * 53) / 91 + (1200 * 38) / 7, 1);
  });

  it("accrues hourly pay regardless of active quarters, up to the end date", () => {
    expect(farmerPayForRange(RATES, "2026-10-01", "2026-10-07", new Set())).toBeCloseTo(1200, 2);
  });

  it("returns 0 with no rates", () => {
    expect(farmerPayForRange([], "2026-01-01", "2026-12-31", new Set())).toBe(0);
  });
});
