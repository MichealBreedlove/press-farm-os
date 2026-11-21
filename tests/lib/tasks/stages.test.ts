import { describe, it, expect } from "vitest";
import { currentStagesOnly, nextStageDueDate, planStageDates, sanitizeStages } from "@/lib/tasks/stages";

describe("sanitizeStages", () => {
  it("keeps steps with a title and a when", () => {
    expect(
      sanitizeStages([
        { title: " Transplant to the field ", offset_days: 21 },
        { title: "Harvest", due_date: "2027-01-15", offset_days: 5, assignee_ids: ["luis", "luis", 7] },
        { title: "", offset_days: 3 },
        { title: "No when" },
        { title: "Bad offset", offset_days: -2 },
        "junk",
      ]),
    ).toEqual([
      { title: "Transplant to the field", description: null, offset_days: 21, due_date: null, assignee_ids: null },
      { title: "Harvest", description: null, offset_days: null, due_date: "2027-01-15", assignee_ids: ["luis"] },
    ]);
    expect(sanitizeStages(undefined)).toEqual([]);
  });
});

describe("planStageDates", () => {
  it("chains offsets from the previous step and keeps fixed dates", () => {
    const steps = sanitizeStages([
      { title: "Transplant", offset_days: 21 },
      { title: "Harvest", due_date: "2027-02-01" },
      { title: "Clear the row", offset_days: 7 },
    ]);
    expect(planStageDates("2026-11-21", steps)).toEqual(["2026-12-12", "2027-02-01", "2027-02-08"]);
  });
  it("dates the next step from the day the previous one was finished", () => {
    expect(nextStageDueDate("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("currentStagesOnly", () => {
  const row = (id: string, group: string | null, index: number | null) => ({
    id,
    stage_group_id: group,
    stage_index: index,
    status: "open",
  });
  it("shows only the lowest open step of each chain", () => {
    const tasks = [row("plain", null, null), row("a1", "A", 1), row("a2", "A", 2), row("b2", "B", 2), row("b3", "B", 3)];
    const lowest = new Map([["A", 1], ["B", 2]]);
    expect(currentStagesOnly(tasks, lowest).map((t) => t.id)).toEqual(["plain", "a1", "b2"]);
  });
  it("hides a later step even when the current step is outside the list", () => {
    expect(currentStagesOnly([row("c3", "C", 3)], new Map([["C", 2]]))).toEqual([]);
  });
});
