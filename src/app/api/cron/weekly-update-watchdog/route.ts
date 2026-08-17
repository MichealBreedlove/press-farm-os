import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_EMAIL, FROM_ADDRESSES } from "@/lib/constants";
import { safeResendSend } from "@/lib/resend/client";
import { hasSuccessfulWeeklyUpdate, upcomingMondayISO } from "@/lib/weekly-update";

export const maxDuration = 60;

/**
 * GET /api/cron/weekly-update-watchdog
 *
 * Fires an hour after the chef Weekly Update cron (see vercel.json) and asks
 * one question: did this week's update actually reach anybody?
 *
 * This exists because of the 2026-08-17 miss. The update silently did not go
 * out and nothing surfaced it — `weekly_update_last_sent_week` is only
 * stamped on success, so "failed" and "never ran" looked identical, and the
 * only trace was a console line nobody reads. The gap was found by a human
 * asking days later.
 *
 * Crucially this checks the OUTCOME, not the job. A send that throws, a
 * Resend rejection, and a cron that never fired all land here the same way —
 * no successful row for this week's Monday, so the farm gets an email. An
 * in-route try/catch could never have caught the third case.
 *
 * Alerts at most once per week (farm_settings.weekly_update_alert_sent_week)
 * so a broken week doesn't turn into a daily nag.
 *
 * Auth: Bearer ${CRON_SECRET}, fail-closed in production. Same pattern as
 * tasks-regenerate.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (!expected) {
    if (isProd) {
      return NextResponse.json(
        { error: "Misconfigured: CRON_SECRET not set in production" },
        { status: 500 },
      );
    }
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const weekAnchor = upcomingMondayISO();

  if (await hasSuccessfulWeeklyUpdate(admin, weekAnchor)) {
    return NextResponse.json({ ok: true, weekOf: weekAnchor, alerted: false });
  }

  // ---- Don't re-alert a week we've already flagged ------------------------
  const { data: settingRows } = await (admin as any)
    .from("farm_settings")
    .select("key, value")
    .eq("key", "weekly_update_alert_sent_week");
  if ((settingRows ?? [])[0]?.value === weekAnchor) {
    return NextResponse.json({
      ok: true,
      weekOf: weekAnchor,
      alerted: false,
      message: "Already alerted for this week.",
    });
  }

  // ---- What DID happen? Newest attempt tells failed-vs-never-ran ----------
  const { data: attempts } = await (admin as any)
    .from("weekly_update_log")
    .select("status, source, recipients_count, succeeded_count, failed_count, error, created_at")
    .eq("week_of", weekAnchor)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = (attempts ?? [])[0] ?? null;

  const diagnosis = last
    ? `The send ran and failed (status: ${last.status}, source: ${last.source ?? "n/a"}, ` +
      `${last.succeeded_count}/${last.recipients_count} delivered).\n\n` +
      `Error: ${last.error ?? "none recorded"}`
    : `No send was attempted at all — the scheduled job never reached the app. ` +
      `Check the Vercel cron logs for /api/reports/weekly-update, and confirm ` +
      `CRON_SECRET is set on the production deployment.`;

  const subject = `⚠️ Press Farm: chefs did NOT get the weekly update (week of ${weekAnchor})`;
  const text = [
    `PRESS FARM — WEEKLY UPDATE WATCHDOG`,
    ``,
    `The chef-facing Weekly Update for the week of ${weekAnchor} has not`,
    `reached a single recipient.`,
    ``,
    diagnosis,
    ``,
    `WHAT TO DO:`,
    `  1. Open /admin/weekly-update — this week's draft is saved and intact.`,
    `  2. Hit Send Now. The saved draft goes out verbatim.`,
    ``,
    `You are getting this once. It will not repeat for this week.`,
    `— Press Farm · Yountville, California`,
  ].join("\n");

  try {
    const res = await safeResendSend({
      from: FROM_ADDRESSES.digest,
      to: ADMIN_EMAIL,
      subject,
      text,
    });
    if (res.error) throw new Error(res.error.message);
  } catch (err) {
    // The alert email itself failed — likely the same Resend problem that
    // broke the update. Leave a loud log line and DON'T stamp the week, so
    // the next run tries again.
    console.error("[WEEKLY-UPDATE-WATCHDOG] Alert email failed to send:", err);
    return NextResponse.json(
      { ok: false, weekOf: weekAnchor, alerted: false, error: String(err) },
      { status: 500 },
    );
  }

  const { data: farmRow } = await admin.from("farms").select("id").limit(1).single();
  if (farmRow?.id) {
    await (admin as any).from("farm_settings").upsert(
      { farm_id: farmRow.id, key: "weekly_update_alert_sent_week", value: weekAnchor },
      { onConflict: "farm_id,key" },
    );
  }

  console.error(`[WEEKLY-UPDATE-WATCHDOG] Alerted: no update sent for week of ${weekAnchor}`);
  return NextResponse.json({ ok: true, weekOf: weekAnchor, alerted: true });
}
