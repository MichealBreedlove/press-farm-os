import { describe, it, expect } from "vitest";
import { buildOrderKey, enumerateOrderKeys } from "@/lib/order-keys";
import type { UnitType } from "@/types";

const ID = "avail-123";

describe("buildOrderKey", () => {
  it("plain key when single-unit and no size", () => {
    expect(buildOrderKey(ID)).toBe("avail-123");
    expect(buildOrderKey(ID, {})).toBe("avail-123");
  });

  it("size-only (legacy) when single-unit with a size", () => {
    expect(buildOrderKey(ID, { size: "Quarter" })).toBe("avail-123__Quarter");
    // size encodes even if a unit is passed, as long as not multi-unit
    expect(buildOrderKey(ID, { unit: "lg", size: "Palm", hasMultiUnits: false })).toBe(
      "avail-123__Palm",
    );
  });

  it("unit segment only appears when hasMultiUnits", () => {
    expect(buildOrderKey(ID, { unit: "lg", hasMultiUnits: true })).toBe("avail-123__unit:lg");
    // a passed unit is ignored for single-unit items
    expect(buildOrderKey(ID, { unit: "lg", hasMultiUnits: false })).toBe("avail-123");
    expect(buildOrderKey(ID, { unit: "lg" })).toBe("avail-123");
  });

  it("multi-unit + size", () => {
    expect(buildOrderKey(ID, { unit: "sm", size: "Quarter", hasMultiUnits: true })).toBe(
      "avail-123__unit:sm__Quarter",
    );
  });

  it("ignores empty/null unit and size", () => {
    expect(buildOrderKey(ID, { unit: "", size: "", hasMultiUnits: true })).toBe("avail-123");
    expect(buildOrderKey(ID, { unit: null, size: null, hasMultiUnits: true })).toBe("avail-123");
  });
});

describe("enumerateOrderKeys", () => {
  const keys = (u: UnitType[], s: string[]) => [...enumerateOrderKeys(ID, u, s)].map((k) => k.key);

  it("single unit, no sizes → just the plain key", () => {
    expect(keys(["ea"] as UnitType[], [])).toEqual(["avail-123"]);
  });

  it("single unit, sizes → legacy size-only keys", () => {
    expect(keys(["ea"] as UnitType[], ["Quarter", "Palm"])).toEqual([
      "avail-123__Quarter",
      "avail-123__Palm",
    ]);
  });

  it("multi-unit, no sizes → unit keys", () => {
    expect(keys(["sm", "lg"] as UnitType[], [])).toEqual([
      "avail-123__unit:sm",
      "avail-123__unit:lg",
    ]);
  });

  it("multi-unit + sizes → cartesian unit×size keys, units outer", () => {
    expect(keys(["sm", "lg"] as UnitType[], ["Quarter", "Palm"])).toEqual([
      "avail-123__unit:sm__Quarter",
      "avail-123__unit:sm__Palm",
      "avail-123__unit:lg__Quarter",
      "avail-123__unit:lg__Palm",
    ]);
  });

  it("yields unit/size metadata alongside the key", () => {
    const out = [...enumerateOrderKeys(ID, ["sm", "lg"] as UnitType[], ["Quarter"])];
    expect(out[0]).toEqual({ key: "avail-123__unit:sm__Quarter", unit: "sm", size: "Quarter" });
  });
});
