import { describe, it, expect } from "vitest";
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_ICONS,
  TASK_SOURCE_LABELS,
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/tasks/constants";

describe("tasks constants", () => {
  // These maps are switch-like — easy to ship out of sync with the
  // DB enums. The tests pin the keys so a migration change forces
  // a constants update.

  it("TASK_TYPE_LABELS covers every farm_task_type", () => {
    expect(Object.keys(TASK_TYPE_LABELS).sort()).toEqual(
      [
        "chef-request",
        "custom",
        "delivery-prep",
        "harvest",
        "inventory",
        "maintenance",
        "sow",
        "terminate",
        "transplant",
      ].sort(),
    );
  });

  it("TASK_TYPE_ICONS covers every farm_task_type", () => {
    expect(Object.keys(TASK_TYPE_ICONS).sort()).toEqual(
      Object.keys(TASK_TYPE_LABELS).sort(),
    );
  });

  it("TASK_SOURCE_LABELS covers every farm_task_source", () => {
    expect(Object.keys(TASK_SOURCE_LABELS).sort()).toEqual(
      ["inbox-confirmed", "manual", "microgreens-auto", "recurring-item"].sort(),
    );
  });

  it("TASK_STATUS_LABELS covers every farm_task_status", () => {
    expect(Object.keys(TASK_STATUS_LABELS).sort()).toEqual(
      ["cancelled", "completed", "open", "snoozed", "superseded"].sort(),
    );
  });

  it("PRIORITY_LABELS and PRIORITY_COLORS cover 1..4", () => {
    for (const p of [1, 2, 3, 4] as const) {
      expect(PRIORITY_LABELS[p]).toBeTruthy();
      expect(PRIORITY_COLORS[p]).toBeTruthy();
    }
  });
});
