/**
 * When the chef Weekly Update goes out — the default Monday send plus the
 * "send later" slots an admin can push it to by a few hours.
 *
 * Vercel crons are UTC-fixed, so the slots are UTC times (see vercel.json):
 *
 *   default   Mon 22:30 UTC                 (3:30 PM PDT / 2:30 PM PST)
 *   late      Mon 23:30, Tue 00:30–05:30 UTC (hourly, to 10:30 PM PDT / 9:30 PM PST)
 *   watchdog  Mon 23:30 UTC, Tue 06:45 UTC
 *
 * Every slot — and the second watchdog — still falls on Monday in Pacific
 * time, so upcomingMondayISO() resolves the same week at each run.
 *
 * Pure (no DB, no server imports) so the admin page can render the same
 * slot list the cron acts on, and so the decision is unit-testable.
 */

export const FARM_TZ = "America/Los_Angeles";

/** The default send + every later slot, as ISO UTC timestamps, for the
 *  week whose Monday (Pacific) is `mondayISO`. Index 0 is the default. */
export function weeklyUpdateSendSlots(mondayISO: string): string[] {
  const mon = new Date(mondayISO + "T00:00:00Z");
  const at = (dayOffset: number, hourUtc: number) => {
    const d = new Date(mon);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(hourUtc, 30, 0, 0);
    return d.toISOString();
  };
  return [at(0, 22), at(0, 23), ...[0, 1, 2, 3, 4, 5].map((h) => at(1, h))];
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

export type CronSendDecision = "send" | "wait" | "idle";

/**
 * What a cron run should do, before the sent/postponed/recipient guards
 * (those still apply on "send").
 *
 * - A delay set for this week → "send" once its slot is reached, else "wait".
 * - No delay → the default run sends; the late runs stay idle, so the
 *   normal week behaves exactly as before.
 */
export function weeklyUpdateCronDecision(opts: {
  nowMs: number;
  mondayISO: string;
  isLateRun: boolean;
  sendAfter: string | null | undefined;
}): CronSendDecision {
  const delay = activeDelay(opts.sendAfter, opts.mondayISO);
  if (delay) {
    return opts.nowMs >= Date.parse(delay) - EARLY_TOLERANCE_MS ? "send" : "wait";
  }
  return opts.isLateRun ? "idle" : "send";
}

/** Watchdog: hold off alerting until a delayed send has had its chance. */
export function watchdogShouldWait(opts: {
  nowMs: number;
  mondayISO: string;
  sendAfter: string | null | undefined;
}): boolean {
  const delay = activeDelay(opts.sendAfter, opts.mondayISO);
  return !!delay && opts.nowMs < Date.parse(delay) + 45 * 60 * 1000;
}
