import { describe, it, expect } from "vitest";
import { effectiveAssigneeId, shortPersonName, summarizeWorkload } from "@/lib/tasks/assign";

describe("effectiveAssigneeId", () => {
  it("uses the explicit assignee when there is one", () => {
    expect(effectiveAssigneeId({ assigned_to: "luis", source: "microgreens-auto" }, "micheal")).toBe("luis");
    expect(effectiveAssigneeId({ assigned_to: "luis", source: "manual" }, "micheal")).toBe("luis");
  });
  it("gives unassigned automated tasks to the farm owner", () => {
    for (const source of ["microgreens-auto", "recurring-item", "inbox-confirmed"]) {
      expect(effectiveAssigneeId({ assigned_to: null, source }, "micheal")).toBe("micheal");
    }
  });
  it("leaves an unassigned manual task for anyone", () => {
    expect(effectiveAssigneeId({ assigned_to: null, source: "manual" }, "micheal")).toBeNull();
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
  const t = (assignee_id: string | null, assignee_name: string | null) => ({ assignee_id, assignee_name });
  it("counts per person, busiest first, anyone last", () => {
    const rows = summarizeWorkload(
      [t("m", "Micheal"), t(null, null), t("l", "Luis"), t("l", "Luis")],
      [t("l", "Luis"), t(null, null), t(null, null), t(null, null)],
    );
    expect(rows).toEqual([
      { id: "l", name: "Luis", todo: 2, upcoming: 1 },
      { id: "m", name: "Micheal", todo: 1, upcoming: 0 },
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
