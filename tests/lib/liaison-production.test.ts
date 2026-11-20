import { describe, it, expect } from "vitest";
import {
  productionWindowStart,
  summarizeMicrogreens,
  summarizeProduction,
  type ProductionLine,
} from "@/lib/liaison/production";

const line = (o: Partial<ProductionLine>): ProductionLine => ({
  date: "2026-11-10",
  deliveryId: "d1",
  restaurant: "Press",
  item: "Kale Mix",
  quantity: 1,
  unit: "lg",
  total: 20,
  ...o,
});

describe("summarizeProduction", () => {
  const today = "2026-11-20";
  const lines = [
    line({}),
    line({ item: "Kale Mix", quantity: 2, unit: "sm", total: 20 }),
    line({ deliveryId: "d2", restaurant: "Under-Study", item: "Figs", quantity: 3, unit: "lbs", total: 24 }),
    line({ date: "2026-10-05", deliveryId: "d3", item: "Radish", total: 100 }),
    line({ date: "2026-01-15", deliveryId: "d4", item: "Carrots", total: 50 }),
    line({ date: "2025-12-20", deliveryId: "d5", item: "Turnip", total: 999 }),
    line({ date: "2026-11-25", deliveryId: "d6", item: "Future", total: 500 }),
  ];
  const s = summarizeProduction(lines, today);

  it("totals this month, last month and year to date", () => {
    expect(s.thisMonth.total).toBe(64);
    expect(s.thisMonth.lines).toBe(3);
    expect(s.thisMonth.deliveries).toBe(2);
    expect(s.lastMonth.total).toBe(100);
    expect(s.yearToDate.total).toBe(214); // excludes Dec 2025 and the future delivery
  });
  it("breaks a period down by restaurant, biggest first", () => {
    expect(s.thisMonth.byRestaurant).toEqual([
      { name: "Press", total: 40, lines: 2 },
      { name: "Under-Study", total: 24, lines: 1 },
    ]);
  });
  it("builds six month bars ending this month", () => {
    expect(s.months.map((m) => m.label)).toEqual(["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(s.months.at(-1)?.total).toBe(64);
    expect(s.months.at(-2)?.total).toBe(100);
  });
  it("ranks top items over 30 days without adding different units", () => {
    expect(s.topItems[0]).toEqual({ name: "Kale Mix", total: 40, quantity: "2 SM · 1 LG" });
    expect(s.topItems.map((i) => i.name)).not.toContain("Radish");
  });
  it("lists recent drop-offs newest first, never future ones", () => {
    expect(s.recent[0].date).toBe("2026-11-10");
    expect(s.recent.some((d) => d.date > today)).toBe(false);
  });
  it("handles January (last month is in the previous year)", () => {
    const jan = summarizeProduction(lines, "2026-01-20");
    expect(jan.lastMonth.total).toBe(999);
    expect(jan.yearToDate.total).toBe(50);
    expect(productionWindowStart("2026-01-20")).toBe("2025-08-01");
    expect(productionWindowStart("2026-11-20")).toBe("2026-01-01");
  });
});

describe("summarizeMicrogreens", () => {
  it("splits ready trays from growing ones and ignores finished trays", () => {
    const m = summarizeMicrogreens([
      { crop: "Kale Mix", status: "harvesting", plannedHarvest: "2026-11-18" },
      { crop: "Kale Mix", status: "harvesting", plannedHarvest: "2026-11-18" },
      { crop: "Pea", status: "light", plannedHarvest: "2026-11-27" },
      { crop: "Pea", status: "blackout", plannedHarvest: "2026-11-24" },
      { crop: "Chervil", status: "light", plannedHarvest: null },
      { crop: "Mustard", status: "terminated", plannedHarvest: null },
      { crop: "Mustard", status: "lost", plannedHarvest: null },
    ]);
    expect(m.ready).toEqual([{ crop: "Kale Mix", trays: 2 }]);
    expect(m.growing).toEqual([
      { crop: "Pea", trays: 2, readyOn: "2026-11-24" },
      { crop: "Chervil", trays: 1, readyOn: null },
    ]);
  });
});
