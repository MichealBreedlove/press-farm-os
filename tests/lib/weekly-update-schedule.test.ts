import { describe, it, expect } from "vitest";
import {
  activeDelay,
  farmLocalToUTC,
  isDefaultSlotFire,
  slotTimeLabel,
  watchdogShouldWait,
  weeklyUpdateCronDecision,
  weeklyUpdateSendSlots,
} from "@/lib/weekly-update-schedule";

/**
 * The chef Weekly Update goes out at 3:30 PM PACIFIC every Monday, summer or
 * winter. Vercel crons are UTC-fixed, so vercel.json fires the route hourly
 * at :30 from Mon 22:30 UTC to Tue 06:30 UTC and the decision here picks the
 * one fire that is the slot. (2026-11-09: the cron used to be pinned to
 * 22:30 UTC and went out at 2:30 PM once PST began.)
 */
const MON = "2026-09-28"; // PDT (UTC−7)
const WINTER = "2026-12-07"; // PST (UTC−8)
const slots = weeklyUpdateSendSlots(MON);
const winter = weeklyUpdateSendSlots(WINTER);
const pacificDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

describe("farmLocalToUTC", () => {
  it("converts a Pacific wall-clock time on either side of DST", () => {
    expect(farmLocalToUTC(MON, 15, 30).toISOString()).toBe("2026-09-28T22:30:00.000Z");
    expect(farmLocalToUTC(WINTER, 15, 30).toISOString()).toBe("2026-12-07T23:30:00.000Z");
    // The Monday right after the clocks fell back (2026-11-01).
    expect(farmLocalToUTC("2026-11-09", 15, 30).toISOString()).toBe("2026-11-09T23:30:00.000Z");
  });
});

describe("weeklyUpdateSendSlots", () => {
  it("summer: default + 7 hourly late slots, 22:30 UTC onward", () => {
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
  it("winter: the same Pacific clock times, an hour later in UTC", () => {
    expect(winter[0]).toBe("2026-12-07T23:30:00.000Z");
    expect(winter[7]).toBe("2026-12-08T06:30:00.000Z");
  });
  it("labels 3:30 PM → 10:30 PM in farm time in BOTH seasons, all on Monday", () => {
    for (const list of [slots, winter]) {
      expect(slotTimeLabel(list[0]!)).toBe("3:30 PM");
      expect(slotTimeLabel(list[7]!)).toBe("10:30 PM");
    }
    for (const iso of slots) expect(pacificDate(iso)).toBe(MON);
    for (const iso of winter) expect(pacificDate(iso)).toBe(WINTER);
  });
  it("every slot in both seasons is covered by the vercel.json fires (:30, Mon 22–23 UTC + Tue 0–6 UTC)", () => {
    for (const iso of [...slots, ...winter]) {
      const d = new Date(iso);
      expect(d.getUTCMinutes()).toBe(30);
      const mondayUtc = d.getUTCDay() === 1;
      if (mondayUtc) expect([22, 23]).toContain(d.getUTCHours());
      else {
        expect(d.getUTCDay()).toBe(2);
        expect(d.getUTCHours()).toBeLessThanOrEqual(6);
      }
    }
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

  it("summer, normal week: the 22:30 UTC fire sends, every other fire is a no-op", () => {
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[0]!), mondayISO: MON, sendAfter: null })).toBe("send");
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[0]!, 1), mondayISO: MON, sendAfter: null })).toBe("send");
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[1]!), mondayISO: MON, sendAfter: null })).toBe("idle");
    expect(weeklyUpdateCronDecision({ nowMs: at("2026-09-29T06:30:00Z"), mondayISO: MON, sendAfter: null })).toBe("idle");
  });
  it("winter, normal week: 22:30 UTC (2:30 PM PST) waits, 23:30 UTC (3:30 PM PST) sends", () => {
    expect(weeklyUpdateCronDecision({ nowMs: at("2026-12-07T22:30:00Z"), mondayISO: WINTER, sendAfter: null })).toBe("wait");
    expect(weeklyUpdateCronDecision({ nowMs: at("2026-12-07T23:30:00Z"), mondayISO: WINTER, sendAfter: null })).toBe("send");
    expect(weeklyUpdateCronDecision({ nowMs: at("2026-12-08T00:30:00Z"), mondayISO: WINTER, sendAfter: null })).toBe("idle");
    // The Monday this bug was reported: 3:30 PM PST is 23:30 UTC.
    expect(weeklyUpdateCronDecision({ nowMs: at("2026-11-09T22:30:41Z"), mondayISO: "2026-11-09", sendAfter: null })).toBe("wait");
    expect(weeklyUpdateCronDecision({ nowMs: at("2026-11-09T23:30:41Z"), mondayISO: "2026-11-09", sendAfter: null })).toBe("send");
  });
  it("delayed: waits until the chosen slot, then sends, then idles", () => {
    const d = slots[3]!; // 6:30 PM
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[0]!), mondayISO: MON, sendAfter: d })).toBe("wait");
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[2]!), mondayISO: MON, sendAfter: d })).toBe("wait");
    expect(weeklyUpdateCronDecision({ nowMs: at(d), mondayISO: MON, sendAfter: d })).toBe("send");
    // A cron that fires a couple of minutes early or late still counts.
    expect(weeklyUpdateCronDecision({ nowMs: at(d, -3), mondayISO: MON, sendAfter: d })).toBe("send");
    expect(weeklyUpdateCronDecision({ nowMs: at(d, 4), mondayISO: MON, sendAfter: d })).toBe("send");
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[4]!), mondayISO: MON, sendAfter: d })).toBe("idle");
  });
  it("a stale delay from last week doesn't hold this week's send", () => {
    const old = weeklyUpdateSendSlots("2026-09-21")[3]!;
    expect(weeklyUpdateCronDecision({ nowMs: at(slots[0]!), mondayISO: MON, sendAfter: old })).toBe("send");
  });
});

describe("isDefaultSlotFire", () => {
  it("is the 3:30 PM Pacific fire in either season", () => {
    expect(isDefaultSlotFire(Date.parse("2026-09-28T22:30:00Z"), MON)).toBe(true);
    expect(isDefaultSlotFire(Date.parse("2026-09-28T23:30:00Z"), MON)).toBe(false);
    expect(isDefaultSlotFire(Date.parse("2026-12-07T22:30:00Z"), WINTER)).toBe(false);
    expect(isDefaultSlotFire(Date.parse("2026-12-07T23:30:00Z"), WINTER)).toBe(true);
  });
});

describe("watchdogShouldWait", () => {
  it("waits for a delayed send, then checks once it's had its chance", () => {
    const d = slots[3]!;
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-09-29T00:30:00Z"), mondayISO: MON, sendAfter: d })).toBe(true);
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-09-29T06:45:00Z"), mondayISO: MON, sendAfter: slots[7] })).toBe(false);
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-09-29T00:30:00Z"), mondayISO: MON, sendAfter: null })).toBe(false);
  });
  it("winter: the Tue 00:30 UTC run is an hour after the 3:30 PM PST send, so it checks", () => {
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-12-08T00:30:00Z"), mondayISO: WINTER, sendAfter: null })).toBe(false);
    // …but never before the send has had its 45 minutes.
    expect(watchdogShouldWait({ nowMs: Date.parse("2026-12-07T23:30:00Z"), mondayISO: WINTER, sendAfter: null })).toBe(true);
  });
});
