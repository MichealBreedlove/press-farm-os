import { describe, it, expect } from "vitest";
import {
  priceForUnit,
  parseUnits,
  formatCurrency,
  formatQty,
  percentChange,
  formatPercentChange,
  getQuarter,
  formatMonthYear,
  formatDeliveryDate,
  formatDateShort,
  toISODate,
  getNextDeliveryDates,
  minOrderableDatePacific,
} from "@/lib/utils";

/**
 * Coverage for the financial-core utilities in src/lib/utils.ts — pricing
 * resolution, currency/quantity formatting, and the date/quarter helpers the
 * reports lean on. These had no automated coverage before.
 */

describe("priceForUnit", () => {
  it("prefers the per-unit price over default_price", () => {
    const item = { default_price: 5, unit_prices: { lg: 12, sm: 8 } };
    expect(priceForUnit(item, "lg")).toBe(12);
    expect(priceForUnit(item, "sm")).toBe(8);
  });

  it("falls back to default_price when the unit has no override", () => {
    const item = { default_price: 5, unit_prices: { lg: 12 } };
    expect(priceForUnit(item, "ea")).toBe(5);
  });

  it("falls back to default_price when unit_prices is missing or null", () => {
    expect(priceForUnit({ default_price: 5 }, "lg")).toBe(5);
    expect(priceForUnit({ default_price: 5, unit_prices: null }, "lg")).toBe(5);
  });

  it("treats a 0 per-unit price as a real price, not a fallback trigger", () => {
    // 0 is a valid number — a free item must not silently fall through to default.
    expect(priceForUnit({ default_price: 5, unit_prices: { ea: 0 } }, "ea")).toBe(0);
  });

  it("falls back when the unit is empty/whitespace/nullish", () => {
    const item = { default_price: 5, unit_prices: { lg: 12 } };
    expect(priceForUnit(item, "")).toBe(5);
    expect(priceForUnit(item, "   ")).toBe(5);
    expect(priceForUnit(item, null)).toBe(5);
    expect(priceForUnit(item, undefined)).toBe(5);
  });

  it("trims the unit before lookup", () => {
    expect(priceForUnit({ default_price: 5, unit_prices: { lg: 12 } }, "  lg  ")).toBe(12);
  });

  it("returns null when neither a unit price nor a default exists", () => {
    expect(priceForUnit({}, "lg")).toBeNull();
    expect(priceForUnit({ default_price: null, unit_prices: { sm: 3 } }, "lg")).toBeNull();
  });
});

describe("parseUnits", () => {
  it("splits a comma-separated unit_type, trimming and dropping blanks", () => {
    expect(parseUnits("ea, lg ,sm")).toEqual(["ea", "lg", "sm"]);
    expect(parseUnits("ea,,lg, ")).toEqual(["ea", "lg"]);
  });

  it("returns an empty array for null/undefined/empty input", () => {
    expect(parseUnits(null)).toEqual([]);
    expect(parseUnits(undefined)).toEqual([]);
    expect(parseUnits("")).toEqual([]);
  });

  it("handles a single unit", () => {
    expect(parseUnits("ea")).toEqual(["ea"]);
  });
});

describe("formatCurrency", () => {
  it("formats with a $ sign, thousands separators, and two decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(7)).toBe("$7.00");
  });

  it("rounds to the cent and renders negatives", () => {
    expect(formatCurrency(2.005)).toBe("$2.01");
    expect(formatCurrency(-5)).toBe("-$5.00");
  });
});

describe("formatQty", () => {
  it("renders whole numbers without a decimal", () => {
    expect(formatQty(2)).toBe("2");
    expect(formatQty(2.0)).toBe("2");
    expect(formatQty(0)).toBe("0");
  });

  it("renders fractional quantities to one decimal place", () => {
    expect(formatQty(1.5)).toBe("1.5");
    expect(formatQty(1.25)).toBe("1.3"); // toFixed(1) rounds
  });
});

describe("percentChange", () => {
  it("computes the signed percentage change", () => {
    expect(percentChange(100, 150)).toBe(50);
    expect(percentChange(100, 50)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
  });

  it("returns 0 when the previous value is 0 (avoids divide-by-zero)", () => {
    expect(percentChange(0, 500)).toBe(0);
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe("formatPercentChange", () => {
  it("prefixes a + for non-negative values and renders one decimal", () => {
    expect(formatPercentChange(15.5)).toBe("+15.5%");
    expect(formatPercentChange(0)).toBe("+0.0%");
    expect(formatPercentChange(-8.25)).toBe("-8.3%");
  });
});

describe("getQuarter", () => {
  it("maps each month to the right calendar quarter", () => {
    expect(getQuarter("2026-01-15")).toBe("Q1 2026");
    expect(getQuarter("2026-03-31")).toBe("Q1 2026");
    expect(getQuarter("2026-04-01")).toBe("Q2 2026");
    expect(getQuarter("2026-06-30")).toBe("Q2 2026");
    expect(getQuarter("2026-07-01")).toBe("Q3 2026");
    expect(getQuarter("2026-09-30")).toBe("Q3 2026");
    expect(getQuarter("2026-10-01")).toBe("Q4 2026");
    expect(getQuarter("2026-12-31")).toBe("Q4 2026");
  });
});

describe("date formatting (timezone-safe via noon anchor)", () => {
  it("formats delivery dates", () => {
    expect(formatDeliveryDate("2026-03-19")).toBe("Thursday, Mar 19");
    expect(formatDateShort("2026-03-19")).toBe("Thu, Mar 19");
  });

  it("formats month/year for reports", () => {
    expect(formatMonthYear("2026-02-01")).toBe("February 2026");
  });

  it("does not drift across the day boundary regardless of host TZ", () => {
    // The noon anchor means the 1st never renders as the previous month.
    expect(formatDeliveryDate("2026-01-01")).toBe("Thursday, Jan 1");
  });
});

describe("toISODate", () => {
  it("renders YYYY-MM-DD", () => {
    expect(toISODate(new Date("2026-03-19T12:00:00Z"))).toBe("2026-03-19");
  });
});

describe("getNextDeliveryDates", () => {
  it("returns the requested count, all on Mon/Thu/Sat, ascending and in the future", () => {
    const dates = getNextDeliveryDates(5);
    expect(dates).toHaveLength(5);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dates.length; i++) {
      expect([1, 4, 6]).toContain(dates[i]!.getDay()); // Mon/Thu/Sat
      expect(dates[i]!.getTime()).toBeGreaterThan(today.getTime());
      if (i > 0) expect(dates[i]!.getTime()).toBeGreaterThan(dates[i - 1]!.getTime());
    }
  });

  it("defaults to 3 dates", () => {
    expect(getNextDeliveryDates()).toHaveLength(3);
  });
});

describe("minOrderableDatePacific", () => {
  // Instants are constructed in UTC; July is PDT (UTC-7), January is PST (UTC-8).
  it("returns today before the 5pm Pacific cutoff", () => {
    // 8:00am PDT
    expect(minOrderableDatePacific(new Date("2026-07-23T15:00:00Z"))).toBe("2026-07-23");
    // 4:59pm PDT — one minute before cutoff
    expect(minOrderableDatePacific(new Date("2026-07-23T23:59:00Z"))).toBe("2026-07-23");
  });

  it("rolls to tomorrow at and after 5pm Pacific", () => {
    // exactly 5:00pm PDT
    expect(minOrderableDatePacific(new Date("2026-07-24T00:00:00Z"))).toBe("2026-07-24");
    // 11:30pm PDT — the late-night order case: must land on the NEXT day
    expect(minOrderableDatePacific(new Date("2026-07-24T06:30:00Z"))).toBe("2026-07-24");
  });

  it("resets at midnight Pacific — early morning orders target the new today", () => {
    // 12:15am PDT on the 24th
    expect(minOrderableDatePacific(new Date("2026-07-24T07:15:00Z"))).toBe("2026-07-24");
  });

  it("is not fooled by UTC already being tomorrow during the evening window (PST)", () => {
    // 4:30pm PST on Jan 15 = 00:30 UTC on Jan 16 — still before cutoff
    expect(minOrderableDatePacific(new Date("2026-01-16T00:30:00Z"))).toBe("2026-01-15");
    // 5:30pm PST on Jan 15 → rolls to Jan 16
    expect(minOrderableDatePacific(new Date("2026-01-16T01:30:00Z"))).toBe("2026-01-16");
  });

  it("rolls across month and year boundaries", () => {
    // 6:00pm PDT on Jul 31 → Aug 1
    expect(minOrderableDatePacific(new Date("2026-08-01T01:00:00Z"))).toBe("2026-08-01");
    // 6:00pm PST on Dec 31 → Jan 1
    expect(minOrderableDatePacific(new Date("2027-01-01T02:00:00Z"))).toBe("2027-01-01");
  });
});
