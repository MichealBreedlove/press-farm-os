import { describe, it, expect } from "vitest";
import { buildTrayLabel, cropInitials } from "@/lib/microgreens/trayLabel";

describe("cropInitials", () => {
  it("uses first 2 letters of single-word name", () => {
    expect(cropInitials("Broccoli")).toBe("BR");
  });

  it("uses first letters of two words", () => {
    expect(cropInitials("Pea Shoot")).toBe("PS");
  });

  it("uses first 2 letters from first 2 words of >2-word name", () => {
    expect(cropInitials("Large Leaf Sorrel")).toBe("LL");
  });

  it("uppercases", () => {
    expect(cropInitials("amaranth")).toBe("AM");
  });
});

describe("buildTrayLabel", () => {
  it("formats as INITIALS-MMDD-SEQ", () => {
    expect(buildTrayLabel("Broccoli", new Date("2026-05-17"), 1)).toBe("BR-0517-01");
  });

  it("zero-pads sequence to 2 digits", () => {
    expect(buildTrayLabel("Broccoli", new Date("2026-05-17"), 12)).toBe("BR-0517-12");
  });

  it("zero-pads month and day", () => {
    expect(buildTrayLabel("Pea Shoot", new Date("2026-01-03"), 5)).toBe("PS-0103-05");
  });
});
