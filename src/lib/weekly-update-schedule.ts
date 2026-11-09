/**
 * When the chef Weekly Update goes out — the default Monday send plus the
 * "send later" slots an admin can push it to by a few hours.
 *
 * The slots are FARM-LOCAL clock times (America/Los_Angeles):
 *
 *   default   Monday 3:30 PM
 *   late      Monday 4:30 PM … 10:30 PM (hourly)
 *
 * Vercel crons are UTC-fixed and can't follow daylight-saving time, so
 * vercel.json fires the route hourly at :30 over a window wide enough to
 * cover every slot in both PDT (UTC−7) and PST (UTC−8): Mon 22:30 UTC
 * through Tue 06:30 UTC. Each run asks `weeklyUpdateCronDecision` whether the
 * current instant IS a slot (the default or the admin's chosen one) and only
 * then sends; every other fire is a no-op. Before 2026-11-09 the default was
 * pinned to 22:30 UTC, so the update went out at 2:30 PM once the clocks fell
 * back — this is what fixed it.
 *
 * Every slot — and every cron fire in the window — still falls on Monday in
 * Pacific time, so upcomingMondayISO() resolves the same week at each run.
 *
 * Pure (no DB, no server imports) so the admin page can render the same
 * slot list the cron acts on, and so the decision is unit-testable.
 */

export const FARM_TZ = "America/Los_Angeles";

/** Default send, farm-local. */
export const DEFAULT_SEND_HOUR = 15;
export const DEFAULT_SEND_MINUTE = 30;
/** Number of hourly "send later" slots after the default (4:30 PM … 10:30 PM). */
const LATE_SLOT_COUNT = 7;

/** Minutes the farm zone is ahead of UTC at `instant` (−420 PDT, −480 PST). */
function farmOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FARM_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The UTC instant of `hour:minute` farm-local on calendar day `dateISO`.
 * Two passes settle the zone offset; DST changes on Sundays, so a Monday
 * evening never straddles one.
 */
export function farmLocalToUTC(dateISO: string, hour: number, minute: number): Date {
  const [y, m, d] = dateISO.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    guess = wall - farmOffsetMinutes(new Date(guess)) * 60_000;
  }
  return new Date(guess);
}

/** The default send + every later slot, as ISO UTC timestamps, for the
 *  week whose Monday (Pacific) is `mondayISO`. Index 0 is the default. */
export function weeklyUpdateSendSlots(mondayISO: string): string[] {
  const slots: string[] = [];
  for (let i = 0; i <= LATE_SLOT_COUNT; i++) {
    slots.push(farmLocalToUTC(mondayISO, DEFAULT_SEND_HOUR + i, DEFAULT_SEND_MINUTE).toISOString());
  }
  return slots;
}

/** "6:30 PM" in farm time. */
export function slotTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: FARM_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A stored send_after only counts for the week it was set for. */
export function activeDelay(sendAfter: string | null | undefined, mondayISO: string): string | null {
  if (!sendAfter) return null;
  const slots = weeklyUpdateSendSlots(mondayISO);
  return slots.slice(1).includes(sendAfter) ? sendAfter : null;
}

/** Cron fires can land a little early; treat a slot as reached this close. */
const EARLY_TOLERANCE_MS = 10 * 60 * 1000;
/** …and a little late. Slots are an hour apart, so −10/+50 is unambiguous. */
const LATE_TOLERANCE_MS = 50 * 60 * 1000;

/** True when `nowMs` is the cron fire that belongs to `slotIso`. */
export function isSlotFire(nowMs: number, slotIso: string): boolean {
  const slot = Date.parse(slotIso);
  return nowMs >= slot - EARLY_TOLERANCE_MS && nowMs < slot + LATE_TOLERANCE_MS;
}

/** True when this fire is the default (3:30 PM) slot — the one run that
 *  should leave a log row even when it ends up not sending. */
export function isDefaultSlotFire(nowMs: number, mondayISO: string): boolean {
  return isSlotFire(nowMs, weeklyUpdateSendSlots(mondayISO)[0]!);
}

export type CronSendDecision = "send" | "wait" | "idle";

/**
 * What a cron run should do, before the sent/postponed/recipient guards
 * (those still apply on "send").
 *
 * - The target is the admin's delay for this week, else the default slot.
 * - "send" when this fire IS the target slot; "wait" when the target is
 *   still ahead (the 2:30 PM PST fire, or any fire before a delayed slot);
 *   "idle" once it has passed, so a normal week sends exactly once.
 */
export function weeklyUpdateCronDecision(opts: {
  nowMs: number;
  mondayISO: string;
  sendAfter: string | null | undefined;
}): CronSendDecision {
  const target = activeDelay(opts.sendAfter, opts.mondayISO) ?? weeklyUpdateSendSlots(opts.mondayISO)[0]!;
  if (isSlotFire(opts.nowMs, target)) return "send";
  return opts.nowMs < Date.parse(target) ? "wait" : "idle";
}

/** Watchdog: hold off alerting until the send (default or delayed) has had
 *  its chance — 45 minutes after its slot. */
export function watchdogShouldWait(opts: {
  nowMs: number;
  mondayISO: string;
  sendAfter: string | null | undefined;
}): boolean {
  const target = activeDelay(opts.sendAfter, opts.mondayISO) ?? weeklyUpdateSendSlots(opts.mondayISO)[0]!;
  return opts.nowMs < Date.parse(target) + 45 * 60 * 1000;
}
