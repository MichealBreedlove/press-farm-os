import { describe, it, expect } from "vitest";
import { effectiveAssigneeIds, isForPerson, shortPersonName, summarizeWorkload } from "@/lib/tasks/assign";

describe("effectiveAssigneeIds", () => {
  it("uses the explicit people when there are any", () => {
    expect(effectiveAssigneeIds({ assigned_to: null, assignee_ids: ["luis", "ana"], source: "manual" }, "m")).toEqual(["luis", "ana"]);
    expect(effectiveAssigneeIds({ assigned_to: "x", assignee_ids: ["luis", "luis"], source: "microgreens-auto" }, "m")).toEqual(["luis"]);
  });
  it("falls back to the older single assigned_to", () => {
    expect(effectiveAssigneeIds({ assigned_to: "luis", assignee_ids: [], source: "manual" }, "m")).toEqual(["luis"]);
  });
  it("gives unassigned automated tasks to the farm owner", () => {
    for (const source of ["microgreens-auto", "recurring-item", "inbox-confirmed"]) {
      expect(effectiveAssigneeIds({ assigned_to: null, source }, "m")).toEqual(["m"]);
    }
  });
  it("leaves an unassigned manual task for anyone", () => {
    expect(effectiveAssigneeIds({ assigned_to: null, assignee_ids: [], source: "manual" }, "m")).toEqual([]);
  });
  it("puts anyone's tasks and the person's own on their list", () => {
    expect(isForPerson([], "luis")).toBe(true);
    expect(isForPerson(["ana", "luis"], "luis")).toBe(true);
    expect(isForPerson(["ana"], "luis")).toBe(false);
  });
});

describe("shortPersonName", () => {
  it("keeps the first name", () => {
    expect(shortPersonName("Micheal Breedlove")).toBe("Micheal");
    expect(shortPersonName("  Luis ")).toBe("Luis");
    expect(shortPersonName("")).toBeNull();
    expect(shortPersonName(null)).toBeNull();
  });
});

describe("summarizeWorkload", () => {
  const t = (ids: string[], names: string[]) => ({ assignee_ids: ids, assignee_names: names });
  it("counts per person, a shared task once for each, anyone last", () => {
    const rows = summarizeWorkload(
      [t(["m"], ["Micheal"]), t([], []), t(["l"], ["Luis"]), t(["l", "m"], ["Luis", "Micheal"])],
      [t(["l"], ["Luis"]), t([], []), t([], []), t([], [])],
    );
    expect(rows).toEqual([
      { id: "l", name: "Luis", todo: 2, upcoming: 1 },
      { id: "m", name: "Micheal", todo: 2, upcoming: 0 },
      { id: null, name: "Anyone", todo: 1, upcoming: 3 },
    ]);
  });
  it("is empty when nothing is open", () => {
    expect(summarizeWorkload([], [])).toEqual([]);
  });
});

import { isMicrogreenTask } from "@/lib/tasks/assign";

describe("isMicrogreenTask", () => {
  it("covers the cron's tray tasks and anything linked to a crop or batch", () => {
    expect(isMicrogreenTask({ source: "microgreens-auto" })).toBe(true);
    expect(isMicrogreenTask({ source: "manual", microgreen_crop_id: "c1" })).toBe(true);
    expect(isMicrogreenTask({ source: "manual", microgreen_batch_id: "b1" })).toBe(true);
  });
  it("leaves field tasks alone", () => {
    expect(isMicrogreenTask({ source: "manual", microgreen_crop_id: null })).toBe(false);
    expect(isMicrogreenTask({ source: "recurring-item" })).toBe(false);
  });
});
