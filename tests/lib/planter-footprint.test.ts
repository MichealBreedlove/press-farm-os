import { describe, it, expect } from "vitest";
import {
  parseDimensionFeet,
  boxFootprintSqFt,
  planterFootprint,
  SQ_FT_PER_ACRE,
} from "@/lib/planter-beds/footprint";

describe("parseDimensionFeet", () => {
  it("parses feet, inches and mixed", () => {
    expect(parseDimensionFeet("12'")).toBe(12);
    expect(parseDimensionFeet(`2'6"`)).toBe(2.5);
    expect(parseDimensionFeet(`23.5"`)).toBeCloseTo(23.5 / 12);
    expect(parseDimensionFeet("7 ft")).toBe(7);
  });
  it("rejects junk", () => {
    expect(parseDimensionFeet("abc")).toBeNull();
    expect(parseDimensionFeet("")).toBeNull();
  });
});

describe("boxFootprintSqFt", () => {
  it("reads the Under-Study wooden boxes", () => {
    expect(boxFootprintSqFt(`Square · 2'6" × 2'6" × 1'4" deep · 8.3 cu ft`)).toBeCloseTo(6.25);
    expect(boxFootprintSqFt(`Long · 2'6" × 12' × 1'4" deep · 40 cu ft`)).toBeCloseTo(30);
    expect(boxFootprintSqFt(`Half-long · 2'6" × 6' × 1'4" deep · 20 cu ft`)).toBeCloseTo(15);
  });
  it("reads the stock tanks", () => {
    expect(boxFootprintSqFt(`4-ft · 23.5" × 44" × 24" · 103 gal`)).toBeCloseTo((23.5 * 44) / 144);
    expect(boxFootprintSqFt(`6-ft · 23.5" × 68" × 24" · 169 gal`)).toBeCloseTo((23.5 * 68) / 144);
  });
  it("returns null without dimensions", () => {
    expect(boxFootprintSqFt(null)).toBeNull();
    expect(boxFootprintSqFt("big")).toBeNull();
  });
});

describe("planterFootprint", () => {
  it("sums active boxes and reports unparsed ones", () => {
    const r = planterFootprint([
      { name: "U2", size: `Long · 2'6" × 12' × 1'4" deep · 40 cu ft` },
      { name: "U1", size: `Square · 2'6" × 2'6" × 1'4" deep · 8.3 cu ft` },
      { name: "X", size: "unknown" },
      { name: "OLD", size: `Long · 2'6" × 12' × 1'4" deep`, is_active: false },
    ]);
    expect(r.sqFt).toBeCloseTo(36.25);
    expect(r.acres).toBeCloseTo(36.25 / SQ_FT_PER_ACRE);
    expect(r.counted).toBe(2);
    expect(r.unparsed).toEqual(["X"]);
  });
});
