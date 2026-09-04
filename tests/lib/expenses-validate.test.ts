import { describe, it, expect } from "vitest";
import { normalizeExpenseCategory, validateExpenseInput } from "@/lib/expenses/validate";

const base = { date: "2026-09-04", category: "Seeds", amount: 12.5 };

describe("normalizeExpenseCategory", () => {
  it("accepts a single known category", () => {
    expect(normalizeExpenseCategory("Seeds")).toBe("Seeds");
  });

  it("accepts the client's ', '-joined multi-category string", () => {
    // This is the exact shape ExpensesClient sends when several tags are selected —
    // the old route rejected it as 'Invalid category', so multi-tag expenses never saved.
    expect(normalizeExpenseCategory("Seeds, Soil, Other")).toBe("Seeds, Soil, Other");
  });

  it("trims whitespace, drops empties and duplicates", () => {
    expect(normalizeExpenseCategory(" Seeds ,Soil,, Seeds")).toBe("Seeds, Soil");
  });

  it("rejects unknown categories, even mixed with known ones", () => {
    expect(normalizeExpenseCategory("Seeds, Bogus")).toBeNull();
    expect(normalizeExpenseCategory("seeds")).toBeNull();
  });

  it("rejects empty / non-string input", () => {
    expect(normalizeExpenseCategory("")).toBeNull();
    expect(normalizeExpenseCategory(", ")).toBeNull();
    expect(normalizeExpenseCategory(undefined)).toBeNull();
    expect(normalizeExpenseCategory(42)).toBeNull();
  });
});

describe("validateExpenseInput", () => {
  it("returns a normalized row for a valid payload", () => {
    const r = validateExpenseInput({
      ...base,
      category: "Seeds, Soil",
      description: "  bulk seed order ",
      vendor: "Johnny's",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        date: "2026-09-04",
        category: "Seeds, Soil",
        description: "bulk seed order",
        vendor: "Johnny's",
        amount: 12.5,
      },
    });
  });

  it("keeps vendor (previously dropped on create)", () => {
    const r = validateExpenseInput({ ...base, vendor: "Home Depot" });
    expect(r.ok && r.value.vendor).toBe("Home Depot");
  });

  it("nulls blank optional text", () => {
    const r = validateExpenseInput({ ...base, description: "", vendor: "   " });
    expect(r.ok && r.value.description).toBeNull();
    expect(r.ok && r.value.vendor).toBeNull();
  });

  it("coerces a numeric-string amount and rounds to cents", () => {
    const r = validateExpenseInput({ ...base, amount: "19.999" });
    expect(r.ok && r.value.amount).toBe(20);
  });

  it("rejects a bad date", () => {
    expect(validateExpenseInput({ ...base, date: "9/4/2026" })).toEqual({ ok: false, error: "Invalid date" });
  });

  it("rejects an unknown category", () => {
    expect(validateExpenseInput({ ...base, category: "Snacks" })).toEqual({ ok: false, error: "Invalid category" });
  });

  it("rejects zero, negative, NaN and missing amounts", () => {
    for (const amount of [0, -1, NaN, "abc", undefined]) {
      const r = validateExpenseInput({ ...base, amount });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects a non-object body", () => {
    expect(validateExpenseInput(null).ok).toBe(false);
    expect(validateExpenseInput("x").ok).toBe(false);
  });
});
