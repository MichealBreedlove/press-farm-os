import { describe, it, expect } from "vitest";
import { mapReorder } from "@/lib/order/reorder";
import { EVENT_MENU_KEY_PREFIX } from "@/lib/constants";

const target = (over: Partial<Parameters<typeof mapReorder>[1][number]> & { itemId: string; name?: string }) => ({
  id: `avail-${over.itemId}`,
  status: "available",
  available_units: null,
  available_sizes: null,
  available_colors: null,
  available_varieties: null,
  ...over,
  item: {
    id: over.itemId,
    name: over.name ?? over.itemId,
    unit_type: "ea",
    size: null,
    color: null,
    variety: null,
    is_archived: false,
    ...(over.item ?? {}),
  },
});

describe("mapReorder", () => {
  it("lands a plain single-unit line on the new date's availability id", () => {
    const r = mapReorder(
      [{ itemId: "peas", itemName: "Peas", quantity: 3, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: null }],
      [target({ itemId: "peas" })],
    );
    expect(r.quantities).toEqual({ "avail-peas": 3 });
    expect(r.placed).toBe(1);
    expect(r.missing).toEqual([]);
  });

  it("keeps multi-unit + size keys when the new row still offers them", () => {
    const r = mapReorder(
      [{ itemId: "nast", itemName: "Nasturtium", quantity: 2, unitType: "lg", sizeLabel: "Palm", colorKey: "red,blue", varietyKey: null, menuSection: null }],
      [target({ itemId: "nast", item: { id: "nast", name: "Nasturtium", unit_type: "sm,lg", size: "Quarter,Palm", color: "red,orange" } })],
    );
    expect(r.quantities).toEqual({ "avail-nast__unit:lg__Palm": 2 });
    // Only colors this cycle still offers carry over.
    expect(r.colors).toEqual({ "avail-nast__unit:lg__Palm": ["red"] });
  });

  it("falls back to the first cell when the old unit/size no longer exists", () => {
    const r = mapReorder(
      [{ itemId: "basil", itemName: "Basil", quantity: 4, unitType: "lg", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: null }],
      [target({ itemId: "basil", item: { id: "basil", name: "Basil", unit_type: "sm,md" } })],
    );
    expect(Object.keys(r.quantities)).toEqual(["avail-basil__unit:sm"]);
    expect(r.quantities["avail-basil__unit:sm"]).toBe(4);
  });

  it("reports items the new date doesn't offer, once each, and skips unavailable rows", () => {
    const r = mapReorder(
      [
        { itemId: "gone", itemName: "Squash Blossoms", quantity: 10, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: null },
        { itemId: "gone", itemName: "Squash Blossoms", quantity: 5, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: "events" },
        { itemId: "off", itemName: "Borage", quantity: 1, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: null },
      ],
      [target({ itemId: "off", status: "unavailable" })],
    );
    expect(r.placed).toBe(0);
    expect(r.missing).toEqual(["Squash Blossoms", "Borage"]);
  });

  it("rebuilds event splits and whole-item event marks", () => {
    const r = mapReorder(
      [
        { itemId: "split", itemName: "Split", quantity: 2, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: null },
        { itemId: "split", itemName: "Split", quantity: 6, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: "events" },
        { itemId: "evt", itemName: "Event only", quantity: 1, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: "events" },
      ],
      [target({ itemId: "split" }), target({ itemId: "evt" })],
    );
    expect(r.quantities["avail-split"]).toBe(2);
    expect(r.quantities[`${EVENT_MENU_KEY_PREFIX}avail-split`]).toBe(6);
    expect(r.splitOpen).toEqual({ "avail-split": true });
    expect(r.eventChecked).toEqual({ "avail-evt": true });
  });

  it("ignores zero-quantity lines", () => {
    const r = mapReorder(
      [{ itemId: "peas", itemName: "Peas", quantity: 0, unitType: "ea", sizeLabel: null, colorKey: null, varietyKey: null, menuSection: null }],
      [target({ itemId: "peas" })],
    );
    expect(r.placed).toBe(0);
    expect(r.quantities).toEqual({});
  });
});
