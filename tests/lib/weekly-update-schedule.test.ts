import { describe, it, expect } from "vitest";
import {
  activeDelay,
  slotTimeLabel,
  watchdogShouldWait,
  weeklyUpdateCronDecision,
  weeklyUpdateSendSlots,
} from "@/lib/weekly-update-schedule";

/**
 * "Send later" for the chef Weekly Update: the slot list must match the
 * crons in vercel.json, and a normal week must behave exactly as before
 * (default run sends, late runs idle).
 */
const MON = "2026-09-28"; // PDT
const slots = weeklyUpdateSendSlots(MON);

describe("weeklyUpdateSendSlots", () => {
  it("default + 7 hourly late slots matching vercel.json", () => {
    expect(slots).toEqual([
      "2026-09-28T22:30:00.000Z",
      "2026-09-28T23:30:00.000Z",
      "2026-09-29T00:30:00.000Z",
      "2026-09-29T01:30:00.000Z",
      "2026-09-29T02:30:00.000Z",
      "2026-09-29T03:30:00.000Z",
      "2026-09-29T04:30:00.000Z",
      "2026-09-29T05:30:00.000Z",
    ]);
  });
  it("labels in farm time, and every slot is still Monday in Pacific", () => {
    expect(slotTimeLabel(slots[0]!)).toBe("3:30 PM");
    expect(slotTimeLabel(slots[7]!)).toBe("10:30 PM");
    for (const iso of slots) {
      expect(new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })).toBe(MON);
    }
    // Winter (PST): an hour earlier on the clock, still Monday.
    const winter = weeklyUpdateSendSlots("2026-12-07");
    expect(slotTimeLabel(winter[0]!)).toBe("2:30 PM");
    expect(new Date(winter[7]!).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })).toBe("2026-12-07");
  });
});

describe("activeDelay", () => {
  it("only counts a later slot of this same week", () => {
    expect(activeDelay(slots[3], MON)).toBe(slots[3]);
    expect(activeDelay(slots[0], MON)).toBeNull(); // default isn't a delay
    expect(activeDelay(weeklyUpdateSendSlots("2026-09-21")[3], MON)).toBeNull(); // last week's
    expect(activeDelay("", MON)).toBeNull();
    expect(activeDelay(null, MON)).toBeNull();
  });
});

describe("weeklyUpdateCronDecision", () => {
  const at = (iso: string, minutes = 0) => Date.parse(iso) + minutes * 60_000;

  it("normal week: default run sends, late runs stay idle", () => {
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[0]!), mondayISO: MON, isLateRun: false, sendAfter: null })).toBe("send");
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[2]!), mondayISO: MON, isLateRun: true, sendAfter: null })).toBe("idle");
  });
  it("delayed: waits until the chosen slot, then sends", () => {
    const d = slots[3]!; // 6:30 PM
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[0]!), mondayISO: MON, isLateRun: false, sendAfter: d })).toBe("wait");
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[2]!), mondayISO: MON, isLateRun: true, sendAfter: d })).toBe("wait");
    expect(weeklyUpdateCronDecision({ nowMs: at(d), mondayISO: MON, isLateRun: true, sendAfter: d })).toBe("send");
    // A cron that fires a couple of minutes early still counts.
    expect(weeklyUpdateCronDecision({ nowMs: at(d, -3), mondayISO: MON, isLateRun: true, sendAfter: d })).toBe("send");
  });
  it("a stale delay from last week doesn't hold this week's send", () => {
    const old = weeklyUpdateSendSlots("2026-09-21")[3]!;
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[0]!), mondayISO: MON, isLateRun: false, sendAfter: old })).toBe("send");
  });
});

describe("watchdogShouldWait", () => {
  it("waits for a delayed send, then checks once it's had its chance", () => {
    const d = slots[3]!;
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-09-28T23:30:00Z"), mondayISO: MON, sendAfter: d })).toBe(true);
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-09-29T06:45:00Z"), mondayISO: MON, sendAfter: slots[7] })).toBe(false);
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-09-28T23:30:00Z"), mondayISO: MON, sendAfter: null })).toBe(false);
  });
});
