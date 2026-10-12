import { describe, it, expect } from "vitest";
import {
  countPlanterBedItems,
  firstSeriesForRestaurant,
  groupPlanterBeds,
  isInSeason,
} from "@/lib/planter-beds/group";

const rows = [
  { name: "Thyme", box: "U19", seasonalMonths: [] },
  { name: "Rosemary", box: "U19", seasonalMonths: [] },
  { name: "Lemon Basil", box: "ST15", seasonalMonths: [] },
  { name: "Yellow Marigold", box: "ST2", seasonalMonths: null },
  { name: "Hummingbird Mint Hyssop", box: "ST6", seasonalMonths: [6, 7, 8, 9] },
  { name: "Queen Seven Table Grape", box: "G2", seasonalMonths: [8, 9, 10] },
  { name: "Aptenia", box: "G2", seasonalMonths: [] },
  { name: "Borage", box: "U2", seasonalMonths: [] },
  { name: "Borage", box: "U2", seasonalMonths: [] }, // duplicate row → one entry
  { name: "", box: "U3", seasonalMonths: [] }, // nameless → dropped
];

describe("isInSeason", () => {
  it("treats an empty or missing list as all year", () => {
    expect(isInSeason([], 1)).toBe(true);
    expect(isInSeason(null, 1)).toBe(true);
    expect(isInSeason(undefined, 12)).toBe(true);
  });
  it("checks the month against a listed season", () => {
    expect(isInSeason([8, 9, 10], 10)).toBe(true);
    expect(isInSeason([8, 9, 10], 11)).toBe(false);
  });
});

describe("groupPlanterBeds", () => {
  it("orders series ST, G, U and boxes by number, items alphabetical", () => {
    const groups = groupPlanterBeds(rows, { month: 10 });
    expect(groups.map((g) => g.series)).toEqual(["ST", "G", "U"]);
    expect(groups[0].beds.map((b) => b.box)).toEqual(["ST2", "ST15"]);
    expect(groups[2].beds.map((b) => b.box)).toEqual(["U2", "U19"]);
    expect(groups[2].beds[1].items).toEqual(["Rosemary", "Thyme"]);
  });

  it("hides out-of-season plantings and de-duplicates", () => {
    const oct = groupPlanterBeds(rows, { month: 10 });
    expect(oct[0].beds.some((b) => b.box === "ST6")).toBe(false); // hyssop is Jun-Sep
    expect(oct[1].beds[0].items).toEqual(["Aptenia", "Queen Seven Table Grape"]);
    expect(oct[2].beds[0].items).toEqual(["Borage"]);

    const dec = groupPlanterBeds(rows, { month: 12 });
    expect(dec[1].beds[0].items).toEqual(["Aptenia"]); // grapes are Aug-Oct
  });

  it("puts the chef's own series first", () => {
    const groups = groupPlanterBeds(rows, { month: 10, firstSeries: "U" });
    expect(groups.map((g) => g.series)).toEqual(["U", "ST", "G"]);
  });

  it("returns nothing for no rows", () => {
    expect(groupPlanterBeds([], { month: 10 })).toEqual([]);
    expect(countPlanterBedItems([])).toBe(0);
  });

  it("counts plantings across groups", () => {
    expect(countPlanterBedItems(groupPlanterBeds(rows, { month: 10 }))).toBe(7);
  });
});

describe("firstSeriesForRestaurant", () => {
  it("leads with U beds for Under-Study only", () => {
    expect(firstSeriesForRestaurant("under-study")).toBe("U");
    expect(firstSeriesForRestaurant("understudy")).toBe("U");
    expect(firstSeriesForRestaurant("press")).toBeNull();
    expect(firstSeriesForRestaurant(null)).toBeNull();
  });
});
