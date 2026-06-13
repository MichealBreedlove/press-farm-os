import { describe, it, expect } from "vitest";
import { sumByKey, rollupByMonth } from "@/lib/reports/aggregate";

describe("sumByKey", () => {
  it("sums a numeric field grouped by key", () => {
    const rows = [
      { cat: "seed", amt: 10 },
      { cat: "soil", amt: 5 },
      { cat: "seed", amt: 2.5 },
    ];
    expect(sumByKey(rows, (r) => r.cat, (r) => r.amt)).toEqual({ seed: 12.5, soil: 5 });
  });

  it("returns an empty object for no rows", () => {
    expect(sumByKey([], (r: { k: string }) => r.k, () => 1)).toEqual({});
  });
});

describe("rollupByMonth", () => {
  const deliveries = [
    { delivery_date: "2026-01-04", total_value: 100, restaurant_id: "r1", name: "Press" },
    { delivery_date: "2026-01-20", total_value: 50, restaurant_id: "r2", name: "Under-Study" },
    { delivery_date: "2026-02-02", total_value: 25, restaurant_id: "r1", name: "Press" },
    { delivery_date: "2026-02-09", total_value: null, restaurant_id: "r1", name: "Press" },
  ];
  const expenses = [
    { date: "2026-01-15", amount: 30 },
    { date: "2026-03-01", amount: 7 }, // expense-only month
  ];

  it("buckets revenue + expenses per month with a per-restaurant split", () => {
    const map = rollupByMonth(deliveries, expenses, (d) => d.name);
    expect(map["2026-01"]).toEqual({
      month: "2026-01",
      total_value: 150,
      total_expenses: 30,
      by_restaurant: { Press: 100, "Under-Study": 50 },
    });
    expect(map["2026-02"]).toEqual({
      month: "2026-02",
      total_value: 25,
      total_expenses: 0,
      by_restaurant: { Press: 25 }, // null total_value contributes 0, no extra key churn
    });
    // an expense-only month still creates a bucket
    expect(map["2026-03"]).toEqual({
      month: "2026-03",
      total_value: 0,
      total_expenses: 7,
      by_restaurant: {},
    });
  });

  it("honours the caller's restaurant-name resolver (e.g. id fallback)", () => {
    const map = rollupByMonth(
      [{ delivery_date: "2026-01-01", total_value: 10, restaurant_id: "r9", name: null as string | null }],
      [],
      (d) => d.name ?? d.restaurant_id,
    );
    expect(map["2026-01"].by_restaurant).toEqual({ r9: 10 });
  });
});
