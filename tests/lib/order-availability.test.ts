import { describe, it, expect } from "vitest";
import {
  filterAvailable,
  resolveUnits,
  resolveSizes,
  resolveColors,
} from "@/lib/order-availability";

/**
 * The chef order form must show only the sizes/colors/units the admin left
 * selected for a given delivery cycle. Regression guard for the bug where the
 * per-cycle `available_*` overrides were ignored and every master option showed
 * as available (Mint published with only Chocolate + Spearmint still listed all).
 */
describe("filterAvailable", () => {
  const master = ["Chocolate", "Spearmint", "Peppermint", "Apple"];

  it("returns all master options when the override is null (no per-cycle restriction)", () => {
    expect(filterAvailable(master, null)).toEqual(master);
  });

  it("returns all master options when the override is undefined", () => {
    expect(filterAvailable(master, undefined)).toEqual(master);
  });

  it("restricts to the override subset, preserving master order", () => {
    expect(filterAvailable(master, "Spearmint,Chocolate")).toEqual(["Chocolate", "Spearmint"]);
  });

  it("tolerates spacing differences between override and master", () => {
    expect(filterAvailable(master, "Chocolate, Spearmint")).toEqual(["Chocolate", "Spearmint"]);
  });

  it("ignores override entries that aren't real master options", () => {
    expect(filterAvailable(master, "Chocolate,Lavender")).toEqual(["Chocolate"]);
  });

  it("treats an empty-string override as 'none available'", () => {
    expect(filterAvailable(master, "")).toEqual([]);
  });
});

describe("resolve helpers", () => {
  it("resolveSizes filters the item's master sizes by the cycle override", () => {
    expect(resolveSizes({ size: "SM, LG, XL" }, "SM,XL")).toEqual(["SM", "XL"]);
    expect(resolveSizes({ size: "SM, LG, XL" }, null)).toEqual(["SM", "LG", "XL"]);
    expect(resolveSizes({ size: null }, null)).toEqual([]);
  });

  it("resolveColors filters the item's master colors by the cycle override", () => {
    expect(resolveColors({ color: "Red, White, Blue" }, "Red,Blue")).toEqual(["Red", "Blue"]);
    expect(resolveColors({ color: "Red, White, Blue" }, null)).toEqual(["Red", "White", "Blue"]);
  });

  it("resolveUnits filters the item's master unit list by the cycle override", () => {
    expect(resolveUnits({ unit_type: "sm,lg,gb" }, "sm,gb")).toEqual(["sm", "gb"]);
    expect(resolveUnits({ unit_type: "sm,lg,gb" }, null)).toEqual(["sm", "lg", "gb"]);
  });
});
