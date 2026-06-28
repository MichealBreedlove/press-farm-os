import { describe, it, expect } from "vitest";
import {
  trayAccrual,
  plantingAccrual,
  valueByMonth,
  valueInRange,
  splitProductionValue,
  mergeMonthMaps,
  daysInclusive,
  addDays,
  PRODUCTION_VALUE_SPLIT_DEFAULT,
} from "@/lib/production-value/accrual";

const round = (n: number) => Math.round(n * 100) / 100;

describe("date helpers", () => {
  it("counts inclusive days", () => {
    expect(daysInclusive("2026-01-01", "2026-01-01")).toBe(1);
    expect(daysInclusive("2026-01-01", "2026-01-31")).toBe(31);
    expect(daysInclusive("2026-02-01", "2026-03-01")).toBe(29); // 2026 not leap → Feb 28 + Mar 1
  });
  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
  });
});

describe("trayAccrual", () => {
  const base = {
    valuePerTray: 1000,
    productiveLifeDays: 30,
    harvestingStart: "2026-06-01",
    today: "2026-12-31",
  };

  it("returns null without value, life days, or harvesting start", () => {
    expect(trayAccrual({ ...base, valuePerTray: null, terminatedAt: null })).toBeNull();
    expect(trayAccrual({ ...base, productiveLifeDays: 0, terminatedAt: null })).toBeNull();
    expect(trayAccrual({ ...base, harvestingStart: null, terminatedAt: null })).toBeNull();
  });

  it("accrues the full value across the productive life (capped) when long-lived", () => {
    const acc = trayAccrual({ ...base, terminatedAt: null })!;
    // 30 days @ $1000/30 = $1000 total, capped — never more even though today is months later.
    expect(acc.start).toBe("2026-06-01");
    expect(acc.end).toBe("2026-06-30"); // 30 inclusive days
    const total = valueInRange(acc, "2026-01-01", "2026-12-31");
    expect(round(total)).toBe(1000);
  });

  it("earns less than the full value when terminated early", () => {
    const acc = trayAccrual({ ...base, terminatedAt: "2026-06-15" })!;
    // 15 inclusive days @ $33.33/day ≈ $500
    expect(round(valueInRange(acc, "2026-01-01", "2026-12-31"))).toBe(round(1000 / 30 * 15));
  });

  it("accrues only up to today while still active", () => {
    const acc = trayAccrual({ ...base, terminatedAt: null, today: "2026-06-10" })!;
    expect(acc.end).toBe("2026-06-10"); // 10 days so far
    expect(round(valueInRange(acc, "2026-01-01", "2026-12-31"))).toBe(round(1000 / 30 * 10));
  });
});

describe("plantingAccrual — annual", () => {
  it("spreads a total evenly over the planted..end window", () => {
    const acc = plantingAccrual({
      lifecycle: "annual",
      valueAmount: 365,
      plantedDate: "2026-01-01",
      endDate: "2026-12-31", // 365 inclusive days in 2026
      seasonalMonths: [],
      today: "2026-12-31",
    })!;
    expect(round(acc.dailyRate)).toBe(1); // $365 / 365 days
    expect(round(valueInRange(acc, "2026-01-01", "2026-12-31"))).toBe(365);
  });

  it("requires an end date", () => {
    expect(
      plantingAccrual({
        lifecycle: "annual",
        valueAmount: 100,
        plantedDate: "2026-01-01",
        endDate: null,
        seasonalMonths: [],
        today: "2026-06-01",
      }),
    ).toBeNull();
  });
});

describe("plantingAccrual — perennial evergreen", () => {
  it("accrues a monthly rate every day up to today", () => {
    const acc = plantingAccrual({
      lifecycle: "perennial_evergreen",
      valueAmount: 100, // $100/month
      plantedDate: "2026-01-01",
      endDate: null,
      seasonalMonths: [],
      today: "2026-12-31",
    })!;
    // ~$100/month × 12 months ≈ $1200 over the year (365 × 100/(365/12)).
    expect(round(valueInRange(acc, "2026-01-01", "2026-12-31"))).toBe(1200);
  });

  it("stops at the removal date", () => {
    const acc = plantingAccrual({
      lifecycle: "perennial_evergreen",
      valueAmount: 100,
      plantedDate: "2026-01-01",
      endDate: "2026-06-30",
      seasonalMonths: [],
      today: "2026-12-31",
    })!;
    expect(acc.end).toBe("2026-06-30");
  });
});

describe("plantingAccrual — perennial dormant", () => {
  it("accrues only during seasonal months", () => {
    const acc = plantingAccrual({
      lifecycle: "perennial_dormant",
      valueAmount: 100, // $100/month
      plantedDate: "2026-01-01",
      endDate: null,
      seasonalMonths: [5, 6, 7, 8], // May–Aug only
      today: "2026-12-31",
    })!;
    // Dormant months contribute nothing.
    const jan = valueByMonth(acc, "2026-12-31")["2026-01"] ?? 0;
    const jun = valueByMonth(acc, "2026-12-31")["2026-06"] ?? 0;
    expect(jan).toBe(0);
    expect(round(jun)).toBeGreaterThan(0);
    // ~4 active months × ~$100 ≈ $400.
    const total = valueInRange(acc, "2026-01-01", "2026-12-31");
    expect(total).toBeGreaterThan(380);
    expect(total).toBeLessThan(420);
  });
});

describe("valueByMonth", () => {
  it("buckets accrual by YYYY-MM and caps at capEnd", () => {
    const acc = trayAccrual({
      valuePerTray: 300,
      productiveLifeDays: 30,
      harvestingStart: "2026-06-20",
      terminatedAt: null,
      today: "2026-07-05",
    })!;
    const m = valueByMonth(acc, "2026-07-05");
    // Jun 20–30 = 11 days, Jul 1–5 = 5 days, $10/day.
    expect(round(m["2026-06"])).toBe(110);
    expect(round(m["2026-07"])).toBe(50);
    expect(m["2026-08"]).toBeUndefined();
  });
});

describe("splitProductionValue", () => {
  it("splits 75/25 by default", () => {
    expect(splitProductionValue(1000)).toEqual({ press: 750, understudy: 250 });
    expect(PRODUCTION_VALUE_SPLIT_DEFAULT).toEqual({ press: 0.75, understudy: 0.25 });
  });
  it("honors a custom split", () => {
    expect(splitProductionValue(200, { press: 0.5, understudy: 0.5 })).toEqual({
      press: 100,
      understudy: 100,
    });
  });
});

describe("mergeMonthMaps", () => {
  it("sums overlapping months", () => {
    expect(
      mergeMonthMaps([
        { "2026-01": 10, "2026-02": 5 },
        { "2026-01": 2, "2026-03": 7 },
      ]),
    ).toEqual({ "2026-01": 12, "2026-02": 5, "2026-03": 7 });
  });
});
