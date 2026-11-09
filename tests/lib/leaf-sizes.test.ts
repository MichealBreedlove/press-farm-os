import { describe, it, expect } from "vitest";
import { leafSizeInches, formatSizeLabel, LEAF_SIZE_INCHES } from "@/lib/leaf-sizes";

/**
 * Chefs ordering small leaves (frilly mustards, Moonshadow, Wasabina, Kale
 * Mix) see the leaf length next to Baby / Small / Medium / Large. The size
 * word itself stays the stored label; the inch range is display-only and
 * leaf-only — a "Baby" carrot gets no hint.
 */
describe("leafSizeInches", () => {
  it("maps the four generic leaf sizes to Micheal's inch scale", () => {
    expect(leafSizeInches("Baby", "herbs_leaves")).toBe('1–2"');
    expect(leafSizeInches("Small", "herbs_leaves")).toBe('2–4"');
    expect(leafSizeInches("Medium", "herbs_leaves")).toBe('4–6"');
    expect(leafSizeInches("Large", "herbs_leaves")).toBe('6–10"');
  });

  it("covers both leaf categories", () => {
    expect(leafSizeInches("Baby", "micros_leaves")).toBe('1–2"');
  });

  it("is case- and whitespace-insensitive on the size word", () => {
    expect(leafSizeInches(" large ", "herbs_leaves")).toBe('6–10"');
    expect(leafSizeInches("BABY", "micros_leaves")).toBe('1–2"');
  });

  it("returns null for non-leaf categories (a Baby tomato is not 1–2 inches)", () => {
    expect(leafSizeInches("Baby", "fruit_veg")).toBeNull();
    expect(leafSizeInches("Large", "flowers")).toBeNull();
  });

  it("returns null for sizes outside the scale (Tiny, coin sizes, inch sizes)", () => {
    expect(leafSizeInches("Tiny", "herbs_leaves")).toBeNull();
    expect(leafSizeInches("Quarter", "herbs_leaves")).toBeNull();
    expect(leafSizeInches("1-2 inch", "herbs_leaves")).toBeNull();
  });

  it("returns null for missing inputs", () => {
    expect(leafSizeInches(null, "herbs_leaves")).toBeNull();
    expect(leafSizeInches("Baby", null)).toBeNull();
    expect(leafSizeInches(undefined, undefined)).toBeNull();
  });

  it("exposes exactly the four sizes", () => {
    expect(Object.keys(LEAF_SIZE_INCHES).sort()).toEqual(["baby", "large", "medium", "small"]);
  });
});

describe("formatSizeLabel", () => {
  it("appends the inch range for leaf items", () => {
    expect(formatSizeLabel("Medium", "herbs_leaves")).toBe('Medium · 4–6"');
  });

  it("leaves non-leaf and unscaled sizes alone", () => {
    expect(formatSizeLabel("Medium", "fruit_veg")).toBe("Medium");
    expect(formatSizeLabel("Palm", "herbs_leaves")).toBe("Palm");
  });

  it("is empty for no size", () => {
    expect(formatSizeLabel(null, "herbs_leaves")).toBe("");
    expect(formatSizeLabel("", "herbs_leaves")).toBe("");
  });
});
