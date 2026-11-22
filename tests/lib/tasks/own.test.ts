import { describe, expect, it } from "vitest";
import { buildOwnTask, isOwnTask, OWN_TASK_MAX_LENGTH } from "@/lib/tasks/own";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("buildOwnTask", () => {
  it("assigns the task to the signed-in person, due today", () => {
    const r = buildOwnTask({ title: "  Fix the  gate \n latch " }, ME, "2026-11-22");
    expect(r).toEqual({
      ok: true,
      row: {
        title: "Fix the gate latch",
        type: "custom",
        source: "manual",
        due_date: "2026-11-22",
        priority: 2,
        assignee_ids: [ME],
        assigned_to: ME,
      },
    });
  });

  it("ignores any assignee sent in the body", () => {
    const r = buildOwnTask({ title: "Water", assignee_ids: [OTHER], assigned_to: OTHER }, ME, "2026-11-22");
    expect(r.ok && r.row.assignee_ids).toEqual([ME]);
    expect(r.ok && r.row.assigned_to).toBe(ME);
  });

  it("tomorrow rolls over the month end", () => {
    const r = buildOwnTask({ title: "Water", when: "tomorrow" }, ME, "2026-11-30");
    expect(r.ok && r.row.due_date).toBe("2026-12-01");
  });

  it("an unknown `when` means today", () => {
    const r = buildOwnTask({ title: "Water", when: "2030-01-01" }, ME, "2026-11-22");
    expect(r.ok && r.row.due_date).toBe("2026-11-22");
  });

  it("takes a picked day, today or later, up to a year out", () => {
    const pick = (date: unknown) => buildOwnTask({ title: "Water", when: "date", date }, ME, "2026-11-22");
    const ok = pick("2026-12-05");
    expect(ok.ok && ok.row.due_date).toBe("2026-12-05");
    expect(pick("2026-11-22").ok).toBe(true);
    expect(pick("2026-11-21").ok).toBe(false);
    expect(pick("2028-01-01").ok).toBe(false);
    expect(pick("2026-02-30").ok).toBe(false);
    expect(pick("12/05/2026").ok).toBe(false);
    expect(pick(undefined).ok).toBe(false);
  });

  it("ignores a date unless a day was picked", () => {
    const r = buildOwnTask({ title: "Water", when: "today", date: "2026-12-05" }, ME, "2026-11-22");
    expect(r.ok && r.row.due_date).toBe("2026-11-22");
  });

  it("rejects empty, non-text and over-long titles", () => {
    expect(buildOwnTask({ title: "   " }, ME, "2026-11-22").ok).toBe(false);
    expect(buildOwnTask({ title: 5 }, ME, "2026-11-22").ok).toBe(false);
    expect(buildOwnTask(null, ME, "2026-11-22").ok).toBe(false);
    expect(buildOwnTask({ title: "x".repeat(OWN_TASK_MAX_LENGTH + 1) }, ME, "2026-11-22").ok).toBe(false);
  });
});

describe("isOwnTask", () => {
  it("is true only for a hand-added task held by that one person", () => {
    expect(isOwnTask({ source: "manual", assignee_ids: [ME] }, ME)).toBe(true);
    expect(isOwnTask({ source: "manual", assignee_ids: [ME, OTHER] }, ME)).toBe(false);
    expect(isOwnTask({ source: "manual", assignee_ids: [OTHER] }, ME)).toBe(false);
    expect(isOwnTask({ source: "manual", assignee_ids: [] }, ME)).toBe(false);
    expect(isOwnTask({ source: "recurring-auto", assignee_ids: [ME] }, ME)).toBe(false);
  });
});
