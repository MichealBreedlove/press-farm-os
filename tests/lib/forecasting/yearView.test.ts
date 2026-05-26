import { describe, it, expect } from "vitest";
import {
  historicalWeeks,
  monthDensity,
  monthSeasonalItems,
} from "@/lib/forecasting/yearView";
import type {
  HistoricalDeliveryRow,
  SeasonalItemRow,
} from "@/lib/forecasting/types";

function row(overrides: Partial<HistoricalDeliveryRow> = {}): HistoricalDeliveryRow {
  return {
    delivery_date: "2026-05-21",
    item_id: "item-1",
    item_name: "Mustard Flowers",
    category: "flowers",
    unit_type: "ea",
    quantity: 5,
    unit: "ea",
    ...overrides,
  };
}

describe("historicalWeeks", () => {
  it("returns empty array for empty input", () => {
    expect(historicalWeeks("2026-01-01", "2026-12-31", [])).toEqual([]);
  });

  it("buckets deliveries by ISO week-start (Monday)", () => {
    // 2026-05-21 is a Thursday → week-start Mon 2026-05-18
    // 2026-05-22 is a Friday   → same week
    // 2026-05-26 is a Tuesday  → week-start Mon 2026-05-25
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-05-21", item_id: "a", item_name: "A" }),
      row({ delivery_date: "2026-05-22", item_id: "b", item_name: "B" }),
      row({ delivery_date: "2026-05-26", item_id: "c", item_name: "C" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ weekStart: "2026-05-18" });
    expect(result[0]?.items.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(result[1]).toMatchObject({ weekStart: "2026-05-25" });
    expect(result[1]?.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("sums quantity for the same item delivered twice in one week", () => {
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-05-21", item_id: "a", item_name: "A", quantity: 3 }),
      row({ delivery_date: "2026-05-23", item_id: "a", item_name: "A", quantity: 4 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.items[0]?.quantity).toBe(7);
  });

  it("ignores deliveries outside the requested window", () => {
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-04-30", item_id: "before" }),
      row({ delivery_date: "2026-06-01", item_id: "after" }),
      row({ delivery_date: "2026-05-15", item_id: "in" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.items.map((i) => i.id)).toEqual(["in"]);
  });

  it("sorts items within a week alphabetically by name", () => {
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-05-21", item_id: "z", item_name: "Zinnias" }),
      row({ delivery_date: "2026-05-21", item_id: "a", item_name: "Amaranth" }),
      row({ delivery_date: "2026-05-21", item_id: "m", item_name: "Marigold" }),
    ]);
    expect(result[0]?.items.map((i) => i.name)).toEqual([
      "Amaranth", "Marigold", "Zinnias",
    ]);
  });
});

// Stubs to keep the test file readable without importing the full
// ForecastCalendarEvent shape — we only need date + name to drive density.
function event(date: string, name: string): any {
  return { date, source: "field", type: "harvest-start", label: name, name, category: null, refId: "ref-" + name };
}

describe("monthDensity", () => {
  it("returns 12-element array for any year", () => {
    const result = monthDensity(2026, {
      past: [],
      concrete: [],
      seasonal: [],
    });
    expect(result).toHaveLength(12);
    expect(result.map((m) => m.month)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
  });

  it("marks empty months as zone=empty count=0", () => {
    const result = monthDensity(2026, { past: [], concrete: [], seasonal: [] });
    expect(result.every((m) => m.zone === "empty" && m.count === 0)).toBe(true);
  });

  it("counts seasonal items per their seasonal_months", () => {
    const seasonal: SeasonalItemRow[] = [
      { id: "tom", name: "Tomato",   category: "fruit_veg", seasonal_months: [7, 8, 9] },
      { id: "bsl", name: "Basil",    category: "herbs_leaves", seasonal_months: [6, 7, 8] },
      { id: "kal", name: "Kale",     category: "herbs_leaves", seasonal_months: [10, 11] },
    ];
    const result = monthDensity(2026, { past: [], concrete: [], seasonal });
    expect(result[6]).toMatchObject({ month: 7, count: 2, zone: "seasonal" }); // Jul: tom, bsl
    expect(result[7]).toMatchObject({ month: 8, count: 2, zone: "seasonal" }); // Aug: tom, bsl
    expect(result[9]).toMatchObject({ month: 10, count: 1, zone: "seasonal" }); // Oct: kal
  });

  it("does not double-count items by name across concrete and seasonal", () => {
    const concrete = [event("2026-07-15", "Tomato")];
    const seasonal: SeasonalItemRow[] = [
      { id: "tom-id", name: "Tomato", category: "fruit_veg", seasonal_months: [7, 8] },
    ];
    const result = monthDensity(2026, { past: [], concrete, seasonal });
    expect(result[6]?.count).toBe(1); // Tomato counted once for July
  });

  it("past zone wins when a month has both past and concrete data", () => {
    const concrete = [event("2026-06-09", "Cherry tomatoes")];
    const past = [
      { weekStart: "2026-05-04", items: [{ id: "rad", name: "Radish", category: null, unit_type: null, quantity: 1, unit: "ea" }] },
    ];
    const result = monthDensity(2026, { past, concrete, seasonal: [] });
    expect(result[4]?.zone).toBe("past"); // May
    expect(result[5]?.zone).toBe("concrete"); // June
  });

  it("ignores data outside the target year", () => {
    const result = monthDensity(2026, {
      past: [
        { weekStart: "2025-12-29", items: [{ id: "x", name: "X", category: null, unit_type: null, quantity: 1, unit: "ea" }] },
      ],
      concrete: [event("2025-06-01", "Old Crop")],
      seasonal: [],
    });
    expect(result.every((m) => m.count === 0)).toBe(true);
  });
});

describe("monthSeasonalItems", () => {
  const items: SeasonalItemRow[] = [
    { id: "1", name: "Tomato",   category: "fruit_veg",     seasonal_months: [7, 8] },
    { id: "2", name: "Basil",    category: "herbs_leaves",  seasonal_months: [6, 7] },
    { id: "3", name: "Marigold", category: "flowers",       seasonal_months: [7] },
    { id: "4", name: "Kale",     category: "herbs_leaves",  seasonal_months: [10] },
  ];

  it("returns items that include the requested month", () => {
    const result = monthSeasonalItems(7, items);
    const ids = Object.values(result).flat().map((i) => i.id).sort();
    expect(ids).toEqual(["1", "2", "3"]);
  });

  it("groups by category", () => {
    const result = monthSeasonalItems(7, items);
    expect(Object.keys(result).sort()).toEqual(["flowers", "fruit_veg", "herbs_leaves"]);
    expect(result.flowers?.map((i) => i.name)).toEqual(["Marigold"]);
    expect(result.fruit_veg?.map((i) => i.name)).toEqual(["Tomato"]);
    expect(result.herbs_leaves?.map((i) => i.name)).toEqual(["Basil"]);
  });

  it("returns empty object when no items match", () => {
    expect(monthSeasonalItems(1, items)).toEqual({});
  });

  it("sorts items within each category by name", () => {
    const more: SeasonalItemRow[] = [
      ...items,
      { id: "5", name: "Sungold", category: "fruit_veg", seasonal_months: [7] },
    ];
    const result = monthSeasonalItems(7, more);
    expect(result.fruit_veg?.map((i) => i.name)).toEqual(["Sungold", "Tomato"]);
  });
});
