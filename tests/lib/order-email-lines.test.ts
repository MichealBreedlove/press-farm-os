import { describe, it, expect } from "vitest";
import { orderEmailLine } from "@/lib/order-email-lines";

const mint = { name: "Mint", category: "herbs_leaves", unit_type: "sm,lg" };

describe("orderEmailLine", () => {
  it("uses the ordered unit, not the catalog's first unit", () => {
    expect(orderEmailLine({ item: mint, unit_type: "lg", color_key: "Chocolate" })).toEqual({
      itemName: "Mint · Chocolate",
      unit: "lg",
    });
  });

  it("falls back to the first catalog unit for legacy lines with no unit", () => {
    expect(orderEmailLine({ item: mint, unit_type: null })).toEqual({ itemName: "Mint", unit: "sm" });
  });

  it("shows the size with the leaf inch guide", () => {
    const line = orderEmailLine({
      item: { name: "Red Frills Mustard", category: "herbs_leaves", unit_type: "sm,lg" },
      unit_type: "lg",
      size_label: "Baby",
    });
    expect(line).toEqual({ itemName: 'Red Frills Mustard · Baby · 1–2"', unit: "lg" });
  });

  it("gives non-leaf sizes no inch hint and tidies multi-select lists", () => {
    const line = orderEmailLine({
      item: { name: "Tomato", category: "vegetables", unit_type: "lbs" },
      size_label: "Baby",
      color_key: "Red,Yellow",
      variety_key: "Sungold",
    });
    expect(line.itemName).toBe("Tomato · Baby · Red, Yellow · Sungold");
  });

  it("marks Events-menu lines and survives a missing item", () => {
    expect(orderEmailLine({ item: mint, unit_type: "sm", menu_section: "events" }).itemName).toBe("Mint (Events)");
    expect(orderEmailLine({ item: null })).toEqual({ itemName: "Unknown item", unit: "" });
  });
});
