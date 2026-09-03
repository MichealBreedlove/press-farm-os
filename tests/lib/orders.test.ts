import { describe, it, expect } from "vitest";
import {
  orderLineKey,
  planOrderItemMerge,
  resolveStaleAvailabilityIds,
  type ExistingOrderLine,
} from "@/lib/orders";

/**
 * Order-line merge decides whether a re-submitted line bumps an existing line's
 * quantity or appends a new one — i.e. what ultimately gets delivered/billed.
 */
describe("orderLineKey", () => {
  it("normalizes null/undefined discriminators to empty strings", () => {
    expect(orderLineKey({ availability_item_id: "a", quantity_requested: 1 })).toBe("a|||||");
    expect(
      orderLineKey({ availability_item_id: "a", unit_type: "lg", size_label: null, quantity_requested: 1 }),
    ).toBe("a|lg||||");
  });

  it("distinguishes lines that differ on any discriminator", () => {
    const base = { availability_item_id: "a", quantity_requested: 1 };
    expect(orderLineKey({ ...base, unit_type: "sm" })).not.toBe(orderLineKey({ ...base, unit_type: "lg" }));
    expect(orderLineKey({ ...base, size_label: "S" })).not.toBe(orderLineKey({ ...base, size_label: "L" }));
    expect(orderLineKey({ ...base, color_key: "red" })).not.toBe(orderLineKey({ ...base, color_key: "blue" }));
    expect(orderLineKey({ ...base, variety_key: "Genovese" })).not.toBe(
      orderLineKey({ ...base, variety_key: "Thai" }),
    );
    expect(orderLineKey({ ...base, menu_section: "events" })).not.toBe(orderLineKey(base));
  });
});

describe("planOrderItemMerge", () => {
  it("sums quantity into a matching existing line", () => {
    const existing: ExistingOrderLine[] = [
      { id: "x1", availability_item_id: "a", unit_type: "lg", quantity_requested: 3 },
    ];
    const incoming = [{ availability_item_id: "a", unit_type: "lg", quantity_requested: 2 }];
    const { toInsert, toUpdate } = planOrderItemMerge(existing, incoming);
    expect(toInsert).toEqual([]);
    expect(toUpdate).toEqual([{ id: "x1", quantity_requested: 5 }]);
  });

  it("appends an unmatched incoming line", () => {
    const existing: ExistingOrderLine[] = [
      { id: "x1", availability_item_id: "a", unit_type: "lg", quantity_requested: 3 },
    ];
    const incoming = [{ availability_item_id: "b", unit_type: "ea", quantity_requested: 4 }];
    const { toInsert, toUpdate } = planOrderItemMerge(existing, incoming);
    expect(toUpdate).toEqual([]);
    expect(toInsert).toEqual(incoming);
  });

  it("keeps different units/sizes of the same item as separate lines", () => {
    const existing: ExistingOrderLine[] = [
      { id: "x1", availability_item_id: "a", unit_type: "lg", quantity_requested: 3 },
    ];
    const incoming = [{ availability_item_id: "a", unit_type: "sm", quantity_requested: 2 }];
    const { toInsert, toUpdate } = planOrderItemMerge(existing, incoming);
    expect(toUpdate).toEqual([]);
    expect(toInsert).toEqual(incoming);
  });

  it("handles a mix of matched and unmatched in one pass", () => {
    const existing: ExistingOrderLine[] = [
      { id: "x1", availability_item_id: "a", unit_type: "lg", quantity_requested: 1 },
      { id: "x2", availability_item_id: "b", unit_type: "ea", quantity_requested: 5 },
    ];
    const incoming = [
      { availability_item_id: "a", unit_type: "lg", quantity_requested: 2 }, // bump x1 -> 3
      { availability_item_id: "c", unit_type: "ea", quantity_requested: 9 }, // new
    ];
    const { toInsert, toUpdate } = planOrderItemMerge(existing, incoming);
    expect(toUpdate).toEqual([{ id: "x1", quantity_requested: 3 }]);
    expect(toInsert).toEqual([{ availability_item_id: "c", unit_type: "ea", quantity_requested: 9 }]);
  });

  it("coerces non-numeric quantities defensively when summing", () => {
    const existing: ExistingOrderLine[] = [
      { id: "x1", availability_item_id: "a", quantity_requested: "3" as unknown as number },
    ];
    const incoming = [{ availability_item_id: "a", quantity_requested: 2 }];
    const { toUpdate } = planOrderItemMerge(existing, incoming);
    expect(toUpdate).toEqual([{ id: "x1", quantity_requested: 5 }]);
  });

  it("keeps different varieties of the same item as separate lines", () => {
    const existing: ExistingOrderLine[] = [
      { id: "x1", availability_item_id: "a", unit_type: "lg", variety_key: "Genovese", quantity_requested: 3 },
    ];
    const incoming = [
      { availability_item_id: "a", unit_type: "lg", variety_key: "Thai", quantity_requested: 2 },
    ];
    const { toInsert, toUpdate } = planOrderItemMerge(existing, incoming);
    expect(toUpdate).toEqual([]);
    expect(toInsert).toEqual(incoming);
  });

  it("distinguishes Events vs Regular lines of the same item", () => {
    const existing: ExistingOrderLine[] = [
      { id: "x1", availability_item_id: "a", menu_section: "events", quantity_requested: 1 },
    ];
    const incoming = [{ availability_item_id: "a", menu_section: null, quantity_requested: 1 }];
    const { toInsert, toUpdate } = planOrderItemMerge(existing, incoming);
    expect(toUpdate).toEqual([]);
    expect(toInsert).toEqual(incoming);
  });
});

/**
 * Submit-time recovery for carts holding availability ids from another
 * date (rollover-before-materialize, admin republish, stale tab). The row
 * behind a stale id still names its item, so the line can be re-pointed at
 * this date's row for the same item instead of failing the whole order.
 */
describe("resolveStaleAvailabilityIds", () => {
  const stale = [
    { id: "old-sorrel", item_id: "sorrel" },
    { id: "old-mint", item_id: "mint" },
    { id: "old-basil", item_id: "basil" },
  ];
  const current = [
    { id: "new-sorrel", item_id: "sorrel", status: "available", item: { name: "Sorrel" } },
    { id: "new-mint", item_id: "mint", status: "limited", item: { name: "Mint" } },
    { id: "new-basil", item_id: "basil", status: "unavailable", item: { name: "Greek Basil" } },
  ];

  it("maps stale ids onto the current date's rows for the same item", () => {
    const r = resolveStaleAvailabilityIds(["old-sorrel", "old-mint"], stale, current);
    expect(Array.from(r.remap.entries())).toEqual([
      ["old-sorrel", "new-sorrel"],
      ["old-mint", "new-mint"],
    ]);
    expect(r.unavailableNames).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  it("names items whose current row is unavailable instead of remapping them", () => {
    const r = resolveStaleAvailabilityIds(["old-sorrel", "old-basil"], stale, current);
    expect(r.remap.get("old-sorrel")).toBe("new-sorrel");
    expect(r.remap.has("old-basil")).toBe(false);
    expect(r.unavailableNames).toEqual(["Greek Basil"]);
    expect(r.unresolved).toEqual([]);
  });

  it("reports ids it cannot place: unknown row, or item with no row for the date", () => {
    const r = resolveStaleAvailabilityIds(
      ["ghost", "old-carrot"],
      [...stale, { id: "old-carrot", item_id: "carrot" }],
      current,
    );
    expect(r.remap.size).toBe(0);
    expect(r.unresolved).toEqual(["ghost", "old-carrot"]);
  });
});
