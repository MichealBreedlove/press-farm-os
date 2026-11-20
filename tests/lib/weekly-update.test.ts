import { describe, it, expect } from "vitest";
import {
  upcomingMondayISO,
  weekOfLabelFor,
  sanitizeWeeklyUpdateData,
  parseWeeklyUpdateDraft,
  compareBoxNames,
  reconcileTaskLines,
  taskLineTitle,
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
  it("keeps a long general note but still caps row text", () => {
    const note = "x".repeat(5000);
    const out = sanitizeWeeklyUpdateData({
      generalNote: note,
      tasksCompleted: ["y".repeat(3000), "short"],
      incoming: [{ label: "~2 Weeks", items: ["a", "b"] }],
    });
    expect(out?.generalNote).toHaveLength(5000);
    expect(out?.tasksCompleted.map((t) => t.length)).toEqual([2000, 5]);
    expect(out?.incoming[0].items).toEqual(["a", "b"]);
  });

  it("rejects non-objects", () => {
    expect(sanitizeWeeklyUpdateData(null)).toBeNull();
    expect(sanitizeWeeklyUpdateData("x")).toBeNull();
    expect(sanitizeWeeklyUpdateData(42)).toBeNull();
  });

  it("coerces a full draft, dropping nameless rows and non-string junk", () => {
    const out = sanitizeWeeklyUpdateData({
      weekOfLabel: "August 10",
      generalNote: "note",
      // Sections removed 2026-10-09 / 2026-10-11 — old saved drafts still carry them.
      planterBeds: [{ name: "Thai Basil", bed: "ST10", planted: "Apr 12", notes: "" }],
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
    expect(out).not.toHaveProperty("planterBeds");
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
    const out = sanitizeWeeklyUpdateData({ incoming: [] });
    expect(out!.tasksCompleted).toEqual([]);
    expect(out!.tasksUpcoming).toEqual([]);
  });

  it("fills a default weekOfLabel when missing", () => {
    const out = sanitizeWeeklyUpdateData({ incoming: [] });
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
        incoming: [{ label: "~2 Weeks", items: ["Peas"] }],
      },
    };
    const parsed = parseWeeklyUpdateDraft(JSON.stringify(draft));
    expect(parsed).not.toBeNull();
    expect(parsed!.weekOf).toBe("2026-08-10");
    expect(parsed!.data.incoming[0].items).toEqual(["Peas"]);
  });
});

describe("compareBoxNames", () => {
  it("puts ST first, then other series, each in number order", () => {
    const names = ["U2", "ST10", "G1", "ST2", "U10", "ST1", "G4", "U1"];
    expect([...names].sort(compareBoxNames)).toEqual(["ST1", "ST2", "ST10", "G1", "G4", "U1", "U2", "U10"]);
  });
});

describe("reconcileTaskLines", () => {
  const live = {
    tasksCompleted: ["Weed the bed (Nov 19)", "Sow Radish (recurring every 14d) (Nov 18)"],
    tasksUpcoming: ["Sow Radish (recurring every 14d) (due Dec 2)", "Plant the garlic (due Nov 24)"],
  };
  it("strips only the trailing status note from a line", () => {
    expect(taskLineTitle("Weed the bed (due Nov 24)")).toBe("Weed the bed");
    expect(taskLineTitle("Sow Radish (recurring every 14d) (due Dec 2)")).toBe("Sow Radish (recurring every 14d)");
    expect(taskLineTitle("No note")).toBe("No note");
  });
  it("moves a task finished since the draft was saved to done", () => {
    const out = reconcileTaskLines(
      { tasksCompleted: ["Fixed the gate (Nov 17)"], tasksUpcoming: ["Weed the bed (due Nov 20)", "Plant the garlic (due Nov 24)"] },
      live,
    );
    expect(out.tasksUpcoming).toEqual(["Plant the garlic (due Nov 24)"]);
    expect(out.tasksCompleted).toEqual(["Fixed the gate (Nov 17)", "Weed the bed (Nov 19)"]);
  });
  it("keeps hand-written lines, deletions and repeating tasks as saved", () => {
    const draft = {
      tasksCompleted: ["Weed the bed — looks great"],
      tasksUpcoming: ["My own note", "Sow Radish (recurring every 14d) (due Dec 2)", "Weed the bed (due Nov 20)"],
    };
    const out = reconcileTaskLines(draft, live);
    expect(out.tasksUpcoming).toEqual(["My own note", "Sow Radish (recurring every 14d) (due Dec 2)"]);
    // "Weed the bed — looks great" has a different title, so the live line is added once.
    expect(out.tasksCompleted).toEqual(["Weed the bed — looks great", "Weed the bed (Nov 19)"]);
  });
  it("preserves the other draft fields", () => {
    const out = reconcileTaskLines({ tasksCompleted: [], tasksUpcoming: [], generalNote: "hi" } as any, live);
    expect((out as any).generalNote).toBe("hi");
  });
});
