import { describe, expect, it } from "vitest";
import { buildOrderEmailItems } from "@/lib/order/email-lines";

const masters = new Map([
  ["a1", { name: "Moonshadow", unit_type: "sm,lg" }],
  ["a2", { name: "Mint", unit_type: "sm,lg" }],
  ["a3", { name: "Radish", unit_type: "ea" }],
]);

describe("buildOrderEmailItems", () => {
  it("shows the ordered unit, not the first unit on the item master", () => {
    const out = buildOrderEmailItems(
      [
        { availability_item_id: "a1", quantity_requested: 1, unit_type: "sm", size_label: "Baby" },
        { availability_item_id: "a2", quantity_requested: 1, unit_type: "lg", color_key: "Chocolate" },
      ],
      masters,
    );
    expect(out).toEqual([
      { itemName: "Moonshadow · Baby", quantity: 1, unit: "sm" },
      { itemName: "Mint · Chocolate", quantity: 1, unit: "lg" },
    ]);
  });

  it("falls back to the master's first unit when the line has none", () => {
    const out = buildOrderEmailItems(
      [{ availability_item_id: "a3", quantity_requested: 12, unit_type: null }],
      masters,
    );
    expect(out[0]).toEqual({ itemName: "Radish", quantity: 12, unit: "ea" });
  });

  it("marks event lines and survives an unknown item", () => {
    const out = buildOrderEmailItems(
      [
        { availability_item_id: "a3", quantity_requested: 2, unit_type: "ea", menu_section: "events" },
        { availability_item_id: "zz", quantity_requested: 1, unit_type: "lg", variety_key: "Tulsi" },
      ],
      masters,
    );
    expect(out[0].itemName).toBe("Radish (Events)");
    expect(out[1]).toEqual({ itemName: "Unknown item · Tulsi", quantity: 1, unit: "lg" });
  });
});
