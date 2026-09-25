import { describe, expect, it } from "vitest";
import { isValidMonth, normalizeExpenseCategory, splitExpenseCategory } from "@/lib/expenses";

describe("normalizeExpenseCategory", () => {
  it("accepts a single known category", () => {
    expect(normalizeExpenseCategory("Seeds")).toBe("Seeds");
  });

  it("accepts multi-category strings the form and export produce", () => {
    expect(normalizeExpenseCategory("Seeds, Soil")).toBe("Seeds, Soil");
  });

  it("normalizes casing, spacing, order, and duplicates", () => {
    expect(normalizeExpenseCategory(" soil ,SEEDS,seeds")).toBe("Seeds, Soil");
  });

  it("rejects unknown categories, empties, and non-strings", () => {
    expect(normalizeExpenseCategory("Seeds, Snacks")).toBeNull();
    expect(normalizeExpenseCategory("")).toBeNull();
    expect(normalizeExpenseCategory(" , ")).toBeNull();
    expect(normalizeExpenseCategory(42)).toBeNull();
  });
});

describe("splitExpenseCategory", () => {
  it("splits stored strings into known categories", () => {
    expect(splitExpenseCategory("Gas, Transport")).toEqual(["Gas", "Transport"]);
  });

  it("returns [] for legacy/unknown values", () => {
    expect(splitExpenseCategory("Fertilizer")).toEqual([]);
    expect(splitExpenseCategory(null)).toEqual([]);
  });
});

describe("isValidMonth", () => {
  it("accepts YYYY-MM only", () => {
    expect(isValidMonth("2026-09")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-9")).toBe(false);
    expect(isValidMonth("garbage")).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
  });
});
