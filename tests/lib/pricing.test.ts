import { describe, it, expect } from "vitest";
import { resolveOrderUnitPrice } from "@/lib/pricing";

/**
 * The order-submit flow freezes resolveOrderUnitPrice's result onto each line.
 * Its 0-default (vs null) is load-bearing for revenue rollups, so lock the
 * precedence and the edge cases down.
 */
describe("resolveOrderUnitPrice", () => {
  const info = (unitPrices: Record<string, number>, defaultPrice: number | null) => ({
    unitPrices,
    defaultPrice,
  });

  it("prefers the per-unit price over default_price", () => {
    expect(resolveOrderUnitPrice(info({ lg: 12, sm: 8 }, 5), "lg")).toBe(12);
    expect(resolveOrderUnitPrice(info({ lg: 12, sm: 8 }, 5), "sm")).toBe(8);
  });

  it("falls back to default_price when the unit has no override", () => {
    expect(resolveOrderUnitPrice(info({ lg: 12 }, 5), "ea")).toBe(5);
  });

  it("returns a per-unit price of exactly 0 as a real price (not a fallback)", () => {
    // typeof 0 === "number" → the explicit free price wins over default_price.
    expect(resolveOrderUnitPrice(info({ ea: 0 }, 5), "ea")).toBe(0);
  });

  it("falls back to default_price when unit is null/empty/undefined", () => {
    expect(resolveOrderUnitPrice(info({ lg: 12 }, 5), null)).toBe(5);
    expect(resolveOrderUnitPrice(info({ lg: 12 }, 5), undefined)).toBe(5);
    expect(resolveOrderUnitPrice(info({ lg: 12 }, 5), "")).toBe(5);
  });

  it("defaults to 0 (not null) when default_price is null — keeps the line in revenue rollups", () => {
    expect(resolveOrderUnitPrice(info({}, null), "lg")).toBe(0);
    expect(resolveOrderUnitPrice(info({ sm: 3 }, null), "lg")).toBe(0);
  });

  it("returns 0 when there is no availability info at all", () => {
    expect(resolveOrderUnitPrice(null, "lg")).toBe(0);
    expect(resolveOrderUnitPrice(undefined, "lg")).toBe(0);
  });

  it("does not treat a non-numeric unit_prices entry as a price", () => {
    // Guards against malformed JSONB — only a numeric entry wins.
    const malformed = { unitPrices: { lg: "12" as unknown as number }, defaultPrice: 5 };
    expect(resolveOrderUnitPrice(malformed, "lg")).toBe(5);
  });

  describe("per-size pricing (size_prices)", () => {
    // Nasturtium: one unit (ea) at $0.40, but "Palm" leaves are $1 each.
    const nasturtium = { unitPrices: { ea: 0.4 }, defaultPrice: 0.4, sizePrices: { Palm: 1 } };

    it("prefers the size price over the per-unit price", () => {
      expect(resolveOrderUnitPrice(nasturtium, "ea", "Palm")).toBe(1);
    });

    it("falls through to the per-unit price for a size with no override", () => {
      expect(resolveOrderUnitPrice(nasturtium, "ea", "Dime - Nickel")).toBe(0.4);
      expect(resolveOrderUnitPrice(nasturtium, "ea", null)).toBe(0.4);
      expect(resolveOrderUnitPrice(nasturtium, "ea", undefined)).toBe(0.4);
    });

    it("trims the size label before matching", () => {
      expect(resolveOrderUnitPrice(nasturtium, "ea", "  Palm  ")).toBe(1);
    });

    it("ignores size_prices when absent (every other item is unaffected)", () => {
      expect(resolveOrderUnitPrice(info({ ea: 0.4 }, 0.4), "ea", "Palm")).toBe(0.4);
    });

    it("treats a size price of exactly 0 as a real price", () => {
      expect(resolveOrderUnitPrice({ unitPrices: { ea: 0.4 }, defaultPrice: 0.4, sizePrices: { Comp: 0 } }, "ea", "Comp")).toBe(0);
    });
  });
});
