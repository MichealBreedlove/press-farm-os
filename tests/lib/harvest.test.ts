import { describe, it, expect } from "vitest";
import {
  aggregateHarvest,
  harvestRestaurantOrder,
  type HarvestOrder,
  type HarvestOrderItem,
} from "@/lib/harvest";

/**
 * aggregateHarvest builds the combined cross-restaurant pick list rendered
 * on /admin/orders/[date] AND the harvester portal (/harvest). It was
 * extracted verbatim from the admin page — these tests pin the merge keys
 * (item × unit × color × variety), the shortage/picked accounting, and the
 * container tallies so both pages keep agreeing.
 */

const press = { id: "r-press", name: "Press" };
const understudy = { id: "r-us", name: "Under-Study" };

function item(id: string, name: string, category = "herbs_leaves", unit_type = "lg") {
  return { availability_item: { item: { id, name, category, unit_type } } };
}

function line(
  itemArgs: ReturnType<typeof item>,
  overrides: Partial<HarvestOrderItem> = {},
): HarvestOrderItem {
  return {
    quantity_requested: 1,
    quantity_fulfilled: null,
    is_shorted: false,
    unit_type: null,
    color_key: null,
    variety_key: null,
    picked_at: null,
    ...itemArgs,
    ...overrides,
  };
}

describe("aggregateHarvest", () => {
  it("returns empty aggregate for no orders", () => {
    const agg = aggregateHarvest([]);
    expect(agg.restaurantsInPlay).toEqual([]);
    expect(agg.categories).toEqual([]);
    expect(agg.containers).toEqual([]);
    expect(agg.itemCount).toBe(0);
    expect(agg.totalLines).toBe(0);
  });

  it("sums the same (item, unit) across restaurants into one row with per-restaurant columns", () => {
    const mint = item("i-mint", "Mint");
    const orders: HarvestOrder[] = [
      { status: "submitted", restaurant: press, order_items: [line(mint, { quantity_requested: 2 })] },
      { status: "submitted", restaurant: understudy, order_items: [line(mint, { quantity_requested: 3 })] },
    ];
    const agg = aggregateHarvest(orders);
    expect(agg.itemCount).toBe(1);
    const row = agg.categories[0].rows[0];
    expect(row.total).toBe(5);
    expect(row.qtyByRestaurant).toEqual({ "r-press": 2, "r-us": 3 });
    expect(agg.submittedOrderCount).toBe(2);
  });

  it("keeps different units / varieties / colors of the same crop on separate rows", () => {
    const basil = item("i-basil", "Basil", "herbs_leaves", "sm,lg");
    const orders: HarvestOrder[] = [
      {
        status: "reviewed",
        restaurant: press,
        order_items: [
          line(basil, { unit_type: "sm", quantity_requested: 1 }),
          line(basil, { unit_type: "lg", quantity_requested: 1 }),
          line(basil, { unit_type: "lg", variety_key: "Genovese", quantity_requested: 2 }),
          line(basil, { unit_type: "lg", color_key: "Purple", quantity_requested: 4 }),
        ],
      },
    ];
    const agg = aggregateHarvest(orders);
    expect(agg.itemCount).toBe(4);
    const rows = agg.categories[0].rows;
    const genovese = rows.find((r) => r.varietyKey === "Genovese");
    expect(genovese?.total).toBe(2);
    const purple = rows.find((r) => r.colorKey === "Purple");
    expect(purple?.total).toBe(4);
  });

  it("uses quantity_fulfilled for shorted lines and drops zero-qty rows", () => {
    const rose = item("i-rose", "Roses", "flowers");
    const orders: HarvestOrder[] = [
      {
        status: "reviewed",
        restaurant: press,
        order_items: [
          line(rose, { is_shorted: true, quantity_requested: 10, quantity_fulfilled: 4 }),
          line(item("i-dahlia", "Dahlias", "flowers"), { is_shorted: true, quantity_requested: 5, quantity_fulfilled: 0 }),
        ],
      },
    ];
    const agg = aggregateHarvest(orders);
    // Fully-shorted dahlias (0 fulfilled) don't appear on the pick list.
    expect(agg.itemCount).toBe(1);
    expect(agg.categories[0].rows[0].total).toBe(4);
    // But both lines count as resolved (shorted closes the loop).
    expect(agg.totalLines).toBe(2);
    expect(agg.resolvedLines).toBe(2);
  });

  it("counts picked lines as resolved", () => {
    const mint = item("i-mint", "Mint");
    const orders: HarvestOrder[] = [
      {
        status: "reviewed",
        restaurant: press,
        order_items: [
          line(mint, { picked_at: "2026-07-18T08:00:00Z" }),
          line(item("i-sage", "Sage")),
        ],
      },
    ];
    const agg = aggregateHarvest(orders);
    expect(agg.totalLines).toBe(2);
    expect(agg.resolvedLines).toBe(1);
  });

  it("falls back to the item's first declared unit when the line has none", () => {
    const kit = item("i-kit", "Salad Kit", "kits", "kit,ea");
    const agg = aggregateHarvest([
      { status: "submitted", restaurant: press, order_items: [line(kit)] },
    ]);
    expect(agg.categories[0].rows[0].unit).toBe("kit");
    expect(agg.containers).toEqual([
      expect.objectContaining({ unit: "kit", count: 1 }),
    ]);
  });

  it("tallies containers by unit, excluding ea, sorted largest first", () => {
    const orders: HarvestOrder[] = [
      {
        status: "submitted",
        restaurant: press,
        order_items: [
          line(item("i-a", "A", "flowers", "lg"), { quantity_requested: 2 }),
          line(item("i-b", "B", "flowers", "sm"), { quantity_requested: 5 }),
          line(item("i-c", "C", "fruit_veg", "ea"), { quantity_requested: 9 }),
        ],
      },
    ];
    const agg = aggregateHarvest(orders);
    expect(agg.containers.map((c) => c.unit)).toEqual(["sm", "lg"]);
    expect(agg.containers[0].count).toBe(5);
  });

  it("orders restaurants Press → Under-Study → Bar → Events", () => {
    const mint = item("i-mint", "Mint");
    const orders: HarvestOrder[] = [
      { status: "submitted", restaurant: { id: "r-ev", name: "Events" }, order_items: [line(mint)] },
      { status: "submitted", restaurant: { id: "r-bar", name: "Press Bar" }, order_items: [line(mint)] },
      { status: "submitted", restaurant: understudy, order_items: [line(mint)] },
      { status: "submitted", restaurant: press, order_items: [line(mint)] },
    ];
    const agg = aggregateHarvest(orders);
    expect(agg.restaurantsInPlay.map((r) => r.name)).toEqual([
      "Press", "Under-Study", "Press Bar", "Events",
    ]);
  });

  it("groups rows by CATEGORY_ORDER with alphabetical items inside", () => {
    const orders: HarvestOrder[] = [
      {
        status: "submitted",
        restaurant: press,
        order_items: [
          line(item("i-z", "Zinnias", "flowers")),
          line(item("i-a", "Asters", "flowers")),
          line(item("i-t", "Tomatoes", "fruit_veg")),
        ],
      },
    ];
    const agg = aggregateHarvest(orders);
    expect(agg.categories.map((c) => c.key)).toEqual(["flowers", "fruit_veg"]);
    expect(agg.categories[0].rows.map((r) => r.name)).toEqual(["Asters", "Zinnias"]);
  });
});

describe("harvestRestaurantOrder", () => {
  it("ranks known restaurants and defaults unknowns last", () => {
    expect(harvestRestaurantOrder("Press")).toBeLessThan(harvestRestaurantOrder("Under-Study"));
    expect(harvestRestaurantOrder("Under-Study")).toBeLessThan(harvestRestaurantOrder("Press Bar"));
    expect(harvestRestaurantOrder("Press Bar")).toBeLessThan(harvestRestaurantOrder("Events"));
    expect(harvestRestaurantOrder("Somewhere Else")).toBe(100);
  });
});
