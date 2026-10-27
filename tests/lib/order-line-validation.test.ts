import { describe, expect, it } from "vitest";
import {
  capText,
  isIsoDate,
  validateLineOptions,
} from "@/lib/order-line-validation";

const figs = {
  item: { unit_type: "sm,lg,gb", size: "Quarter, Palm", color: "red, green", variety: null },
  available_units: null,
  available_sizes: null,
  available_colors: null,
  available_varieties: null,
};

describe("validateLineOptions", () => {
  it("accepts a unit the item sells", () => {
    expect(validateLineOptions(figs, { unit_type: "gb" }, "Figs")).toBeNull();
  });

  it("rejects a unit the item does not sell (would have priced at default_price)", () => {
    expect(validateLineOptions(figs, { unit_type: "bx" }, "Figs")).toMatch(/BX/);
  });

  it("rejects a unit the cycle override removed", () => {
    expect(
      validateLineOptions({ ...figs, available_units: "lg" }, { unit_type: "sm" }, "Figs"),
    ).toMatch(/SM/);
    expect(
      validateLineOptions({ ...figs, available_units: "lg" }, { unit_type: "lg" }, "Figs"),
    ).toBeNull();
  });

  it("accepts an omitted unit (legacy callers backfill the first unit)", () => {
    expect(validateLineOptions(figs, {}, "Figs")).toBeNull();
  });

  it("rejects a mistyped size and accepts a real one", () => {
    expect(validateLineOptions(figs, { size_label: "Larg" }, "Figs")).toMatch(/Larg/);
    expect(validateLineOptions(figs, { size_label: "Palm" }, "Figs")).toBeNull();
  });

  it("checks every color / variety key in a multi-select", () => {
    expect(validateLineOptions(figs, { color_key: "red,green" }, "Figs")).toBeNull();
    expect(validateLineOptions(figs, { color_key: "red,blue" }, "Figs")).toMatch(/blue/);
    expect(
      validateLineOptions(
        { ...figs, item: { ...figs.item, variety: "Genovese, Thai" }, available_varieties: "Thai" },
        { variety_key: "Genovese" },
        "Basil",
      ),
    ).toMatch(/Genovese/);
  });

  it("rejects colors when the item has none", () => {
    expect(
      validateLineOptions({ ...figs, item: { ...figs.item, color: null } }, { color_key: "red" }, "Figs"),
    ).toMatch(/red/);
  });
});

describe("capText / isIsoDate", () => {
  it("trims, caps and nulls empties", () => {
    expect(capText("  hi  ")).toBe("hi");
    expect(capText("")).toBeNull();
    expect(capText(42)).toBeNull();
    expect(capText("x".repeat(600))?.length).toBe(500);
  });
  it("accepts only YYYY-MM-DD", () => {
    expect(isIsoDate("2026-10-27")).toBe(true);
    expect(isIsoDate("10/27/2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
