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
});
