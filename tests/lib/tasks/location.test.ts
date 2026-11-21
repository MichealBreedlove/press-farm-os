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
