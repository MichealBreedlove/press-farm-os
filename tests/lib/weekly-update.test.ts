import { describe, it, expect } from "vitest";
import {
  upcomingMondayISO,
  weekOfLabelFor,
  sanitizeWeeklyUpdateData,
  parseWeeklyUpdateDraft,
  compareBoxNames,
} from "@/lib/weekly-update";

describe("upcomingMondayISO", () => {
  it("returns the same day when today is Monday", () => {
    expect(upcomingMondayISO("2026-08-10")).toBe("2026-08-10"); // a Monday
  });

  it("returns the coming Monday for mid-week days", () => {
    expect(upcomingMondayISO("2026-08-08")).toBe("2026-08-10"); // Saturday → Monday
    expect(upcomingMondayISO("2026-08-11")).toBe("2026-08-17"); // Tuesday → next Monday
    expect(upcomingMondayISO("2026-08-09")).toBe("2026-08-10"); // Sunday → Monday
  });
});

describe("weekOfLabelFor", () => {
  it("formats as month + day", () => {
    expect(weekOfLabelFor("2026-08-10")).toBe("August 10");
  });
});

describe("sanitizeWeeklyUpdateData", () => {
  it("rejects non-objects", () => {
    expect(sanitizeWeeklyUpdateData(null)).toBeNull();
    expect(sanitizeWeeklyUpdateData("x")).toBeNull();
    expect(sanitizeWeeklyUpdateData(42)).toBeNull();
  });

  it("coerces a full draft, dropping nameless rows and non-string junk", () => {
    const out = sanitizeWeeklyUpdateData({
      weekOfLabel: "August 10",
      generalNote: "note",
      planterBeds: [
        { name: "Thai Basil", bed: "ST10", planted: "Apr 12", notes: "" },
        { name: "Lemon Basil", bed: "ST2", planted: "Apr 12", notes: "" },
        { name: "", bed: "x", planted: "", notes: "" }, // nameless → dropped
        { name: 42, bed: {}, planted: [], notes: null }, // junk → dropped (name not string)
      ],
      // Sections removed 2026-10-09 — old saved drafts still carry them.
      availableNow: [{ name: "Squash Blossoms", qty: "12", size: "EA", notes: "" }],
      gaps: [{ name: "Snap Peas", lastWeek: "Yes", substitute: "—", backWhen: "~Jun 14" }],
      incoming: [
        { label: "~2 Weeks", items: ["Peas", "", 7, "Cukes"] },
        { label: "", items: ["dropped — no label"] },
      ],
      tasksCompleted: ["Sowed brassicas", "", 42],
      tasksUpcoming: ["Fix drip line", null],
    });
    expect(out).not.toBeNull();
    expect(out!.planterBeds.map((r) => r.bed)).toEqual(["ST2", "ST10"]);
    expect(out).not.toHaveProperty("availableNow");
    expect(out).not.toHaveProperty("gaps");
    expect(out!.incoming).toHaveLength(1);
    expect(out!.incoming[0].items).toEqual(["Peas", "Cukes"]);
    expect(out!.generalNote).toBe("note");
    expect(out!.weekOfLabel).toBe("August 10");
    expect(out!.tasksCompleted).toEqual(["Sowed brassicas"]);
    expect(out!.tasksUpcoming).toEqual(["Fix drip line"]);
  });

  it("defaults task lists to empty arrays for pre-task drafts", () => {
    const out = sanitizeWeeklyUpdateData({ planterBeds: [], incoming: [] });
    expect(out!.tasksCompleted).toEqual([]);
    expect(out!.tasksUpcoming).toEqual([]);
  });

  it("fills a default weekOfLabel when missing", () => {
    const out = sanitizeWeeklyUpdateData({ planterBeds: [], incoming: [] });
    expect(out!.weekOfLabel.length).toBeGreaterThan(0);
  });
});

describe("parseWeeklyUpdateDraft", () => {
  it("returns null for empty, malformed, or stampless values", () => {
    expect(parseWeeklyUpdateDraft(null)).toBeNull();
    expect(parseWeeklyUpdateDraft("")).toBeNull();
    expect(parseWeeklyUpdateDraft("not json")).toBeNull();
    expect(parseWeeklyUpdateDraft(JSON.stringify({ data: { generalNote: "x" } }))).toBeNull();
  });

  it("round-trips a valid draft envelope", () => {
    const draft = {
      weekOf: "2026-08-10",
      data: {
        weekOfLabel: "August 10",
        generalNote: "hi",
        planterBeds: [{ name: "Mint", bed: "ST1", planted: "May 1", notes: "" }],
        incoming: [{ label: "~2 Weeks", items: ["Peas"] }],
      },
    };
    const parsed = parseWeeklyUpdateDraft(JSON.stringify(draft));
    expect(parsed).not.toBeNull();
    expect(parsed!.weekOf).toBe("2026-08-10");
    expect(parsed!.data.planterBeds[0].name).toBe("Mint");
  });
});

describe("compareBoxNames", () => {
  it("puts ST first, then other series, each in number order", () => {
    const names = ["U2", "ST10", "G1", "ST2", "U10", "ST1", "G4", "U1"];
    expect([...names].sort(compareBoxNames)).toEqual(["ST1", "ST2", "ST10", "G1", "G4", "U1", "U2", "U10"]);
  });
});
