import { describe, it, expect } from "vitest";
import { addDays, daysBetween, toIsoDate, todayIso, isPastIso } from "@/lib/tasks/dates";

describe("dates helpers", () => {
  it("toIsoDate is UTC-anchored", () => {
    const d = new Date("2026-05-27T23:00:00Z");
    expect(toIsoDate(d)).toBe("2026-05-27");
  });

  it("addDays handles month rollover", () => {
    expect(addDays("2026-05-30", 5)).toBe("2026-06-04");
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });

  it("addDays handles negative offsets", () => {
    expect(addDays("2026-06-04", -5)).toBe("2026-05-30");
  });

  it("daysBetween counts whole days", () => {
    expect(daysBetween("2026-05-01", "2026-05-15")).toBe(14);
    expect(daysBetween("2026-05-15", "2026-05-01")).toBe(-14);
  });

  it("isPastIso compares against today (UTC)", () => {
    const now = new Date("2026-05-27T12:00:00Z");
    expect(isPastIso("2026-05-26", now)).toBe(true);
    expect(isPastIso("2026-05-27", now)).toBe(false);
    expect(isPastIso("2026-05-28", now)).toBe(false);
  });

  it("todayIso returns the current UTC date string", () => {
    const now = new Date("2026-05-27T05:30:00Z");
    expect(todayIso(now)).toBe("2026-05-27");
  });
});
