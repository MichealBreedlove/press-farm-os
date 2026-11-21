import { describe, it, expect } from "vitest";
import { formatLocation, sanitizeLocation } from "@/lib/tasks/location";

describe("sanitizeLocation", () => {
  it("keeps valid fields and drops junk", () => {
    expect(sanitizeLocation({ location_place: "farm", location_quadrant: "3", location_rows: " 5-6 " })).toEqual({
      location_place: "farm",
      location_quadrant: 3,
      location_rows: "5-6",
    });
    expect(sanitizeLocation({ location_place: "moon", location_quadrant: 0, location_rows: "" })).toEqual({
      location_place: null,
      location_quadrant: null,
      location_rows: null,
    });
    expect(sanitizeLocation(null).location_place).toBeNull();
  });
});

describe("formatLocation", () => {
  it("reads naturally in English and Spanish", () => {
    const l = { location_place: "farm" as const, location_quadrant: 3, location_rows: "5-6" };
    expect(formatLocation(l)).toBe("Farm · Quadrant 3 · Rows 5-6");
    expect(formatLocation(l, "es")).toBe("Granja · Cuadrante 3 · Hileras 5-6");
    expect(formatLocation({ location_rows: "4" })).toBe("Row 4");
    expect(formatLocation({ location_place: "greenhouse" }, "es")).toBe("Invernadero");
    expect(formatLocation({})).toBeNull();
  });
});

import { parseLocationFromText } from "@/lib/tasks/location";

describe("parseLocationFromText", () => {
  it("reads quadrant and rows from the Where: part", () => {
    expect(parseLocationFromText("Where: Quadrant 1, rows 4-5. How: Direct seed. ES: Sembrar …")).toEqual({
      location_place: "farm",
      location_quadrant: 1,
      location_rows: "4-5",
    });
    expect(parseLocationFromText("Where: Quadrant 3, rows 5-6. How much: 2 trays worth.").location_rows).toBe("5-6");
  });
  it("treats greenhouse work as the greenhouse", () => {
    expect(parseLocationFromText("Where: Greenhouse trays; these go to Quadrant 3 rows 5-6.").location_place).toBe(
      "farm",
    );
    expect(parseLocationFromText("Where: Greenhouse bench 2.")).toEqual({
      location_place: "greenhouse",
      location_quadrant: null,
      location_rows: null,
    });
  });
  it("never guesses", () => {
    expect(parseLocationFromText("Where: Oak woodland toward the Sonoma coast.").location_place).toBeNull();
    expect(parseLocationFromText(null).location_place).toBeNull();
  });
});
