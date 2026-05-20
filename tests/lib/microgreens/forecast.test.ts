import { describe, it, expect } from "vitest";
import { computeForecast } from "@/lib/microgreens/forecast";

type Row = { delivery_date: string; quantity_oz: number; item_id: string };

describe("computeForecast", () => {
  it("returns 0 for crops with no item_id", () => {
    const result = computeForecast([], null, 4 /* Thursday */, new Date("2026-05-17"));
    expect(result).toBe(0);
  });

  it("averages oz across deliveries on the same day-of-week", () => {
    // 4 Thursdays of deliveries: 8, 10, 12, 6 -> avg 9
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8,  item_id: "i1" }, // Thu
      { delivery_date: "2026-05-07", quantity_oz: 10, item_id: "i1" },
      { delivery_date: "2026-04-30", quantity_oz: 12, item_id: "i1" },
      { delivery_date: "2026-04-23", quantity_oz: 6,  item_id: "i1" },
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(9);
  });

  it("ignores deliveries for other items", () => {
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8,  item_id: "i1" },
      { delivery_date: "2026-05-14", quantity_oz: 99, item_id: "i2" },
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(8);
  });

  it("ignores deliveries outside the lookback window", () => {
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8, item_id: "i1" }, // in window
      { delivery_date: "2026-01-01", quantity_oz: 99, item_id: "i1" }, // out
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(8);
  });

  it("ignores deliveries on different day-of-week", () => {
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8,  item_id: "i1" }, // Thu
      { delivery_date: "2026-05-16", quantity_oz: 99, item_id: "i1" }, // Sat
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(8);
  });

  it("returns 0 when no matching deliveries", () => {
    expect(computeForecast([], "i1", 4, new Date("2026-05-17"))).toBe(0);
  });
});
