import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWeeklyUpdateData,
  parseWeeklyUpdateDraft,
  recordWeeklyUpdateAttempt,
  sanitizeWeeklyUpdateData,
  upcomingMondayISO,
  upsertFarmSetting,
  type WeeklyUpdateData,
} from "@/lib/weekly-update";
import WeeklyUpdate from "@/emails/weekly-update";
import { isDefaultSlotFire, slotTimeLabel, weeklyUpdateCronDecision } from "@/lib/weekly-update-schedule";
import { requireCronSecret } from "@/lib/api-auth";

// A Resend call on top of a possible live build; the plan-default budget
// (10 s on Hobby) is too tight. 60 s is allowed on every Vercel plan.
export const maxDuration = 60;

/** Resend's limit on `to` addresses in a single email. */
const MAX_TO_PER_EMAIL = 50;

/**
 * Chef-facing "Press Farm – Weekly Update" email.
 *
 *   GET  — Vercel Cron trigger. Requires `Authorization: Bearer
 *          ${CRON_SECRET}`; fail-closed in production. Fires HOURLY at :30
 *          from Mon 22:30 UTC to Tue 06:30 UTC (the query string only keeps
 *          the vercel.json entries distinct); each run sends only when the
 *          clock is at this week's slot — 3:30 PM Pacific by default, or the
 *          later time the admin picked (farm_settings.weekly_update_send_after
 *          — see src/lib/weekly-update-schedule.ts). Crons are UTC-fixed, so
 *          deciding by the Pacific clock is what keeps the send at 3:30 PM
 *          through daylight-saving changes. Sends the saved draft when one
 *          exists for this week (so admin edits go out verbatim), otherwise
 *          builds from live data. Skips entirely if this week's update was
 *          already sent manually.
 *   POST — Manual admin trigger from /admin/weekly-update. An optional
 *          `data` body sends exactly that (edited) content; without it the
 *          same draft-then-live resolution as the cron applies.
 *
 * Recipients: ONLY the addresses stored comma-separated in
 * farm_settings.weekly_update_recipients — chosen per-person on
 * /admin/weekly-update (chefs are offered as a picker but are not
 * auto-included). The whole list goes in the `to` line of a single email
 * (one shared thread), not one email per address.
 */
export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  return sendWeeklyUpdate({ isCron: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const edited = sanitizeWeeklyUpdateData(body?.data);
  // `testTo` sends this week's update to that one address only, marked [TEST].
  // It never touches the real recipient list, the sent-week stamp or the log,
  // so Monday's automatic send still goes out as normal.
  const testTo =
    typeof body?.testTo === "string" && /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(body.testTo.trim())
      ? body.testTo.trim().toLowerCase()
      : null;
  if (body?.testTo && !testTo) {
    return NextResponse.json({ success: false, error: "Enter a valid email address for the test." }, { status: 400 });
  }
  return sendWeeklyUpdate({ isCron: false, edited, testTo });
}

async function sendWeeklyUpdate({
  isCron,
  edited,
  testTo = null,
}: {
  isCron: boolean;
  edited?: WeeklyUpdateData | null;
  testTo?: string | null;
}) {
  const admin = createAdminClient();
  const weekAnchor = upcomingMondayISO();

  // ---- Settings: recipients + saved draft + last-sent guard --------------
  const { data: settingRows } = await (admin as any)
    .from("farm_settings")
    .select("key, value")
    .in("key", [
      "weekly_update_recipients",
      "weekly_update_draft",
      "weekly_update_last_sent_week",
      "weekly_update_postponed_week",
      "weekly_update_send_after",
    ]);
  const settingsMap: Record<string, string> = {};
  for (const row of settingRows ?? []) settingsMap[row.key] = row.value ?? "";

  const triggeredBy = isCron ? "cron" : "manual";

  // The cron fires hourly across the whole evening window; only the fire that
  // lands on this week's slot (3:30 PM Pacific, or the admin's later pick)
  // sends. Checked before logging so an ordinary Monday doesn't write a row
  // per idle fire.
  const nowMs = Date.now();
  const isDefaultSlot = isCron && isDefaultSlotFire(nowMs, weekAnchor);
  if (isCron) {
    const sendAfter = settingsMap.weekly_update_send_after || null;
    const decision = weeklyUpdateCronDecision({
      nowMs,
      mondayISO: weekAnchor,
      sendAfter,
    });
    if (decision === "idle") {
      return NextResponse.json({ success: true, skipped: true, message: "Not this week's send time." });
    }
    if (decision === "wait") {
      const message = sendAfter
        ? `Delayed by admin — sending at ${slotTimeLabel(sendAfter)} instead.`
        : "Before this week's send time.";
      // One log row for the default-slot fire is enough; the other waits are silent.
      if (isDefaultSlot) {
        await recordWeeklyUpdateAttempt(admin, {
          weekOf: weekAnchor,
          triggeredBy,
          status: "skipped",
          error: message,
        });
      }
      return NextResponse.json({ success: true, skipped: true, message });
    }
  }

  // Cron never double-sends a week the admin already sent manually.
  if (isCron && settingsMap.weekly_update_last_sent_week === weekAnchor) {
    const message = `Already sent for week of ${weekAnchor} — skipping scheduled send.`;
    await recordWeeklyUpdateAttempt(admin, {
      weekOf: weekAnchor,
      triggeredBy,
      status: "skipped",
      error: message,
    });
    return NextResponse.json({ success: true, skipped: true, message });
  }

  // Admin hit "Postpone" on /admin/weekly-update for this week. Only the
  // automatic send honors it — Send Now still goes out whenever they're ready.
  if (isCron && settingsMap.weekly_update_postponed_week === weekAnchor) {
    const message = `Postponed by admin for week of ${weekAnchor} — skipping scheduled send.`;
    await recordWeeklyUpdateAttempt(admin, {
      weekOf: weekAnchor,
      triggeredBy,
      status: "skipped",
      error: message,
    });
    return NextResponse.json({ success: true, skipped: true, message });
  }

  // ---- Recipients: exactly the saved list, nobody else -------------------
  const recipients = new Set<string>();
  if (testTo) {
    recipients.add(testTo);
  } else {
    for (const entry of (settingsMap.weekly_update_recipients ?? "").split(",")) {
      const email = entry.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }
  if (recipients.size === 0) {
    const error =
      "No recipients configured — pick who gets the update on the Weekly Update page.";
    await recordWeeklyUpdateAttempt(admin, {
      weekOf: weekAnchor,
      triggeredBy,
      status: "skipped",
      error,
    });
    return NextResponse.json({ success: false, skipped: true, error });
  }

  // ---- Content: explicit edit > this week's saved draft > live build -----
  let data = edited ?? null;
  let source: "edited" | "draft" | "live" = "edited";
  if (!data) {
    const draft = parseWeeklyUpdateDraft(settingsMap.weekly_update_draft);
    if (draft && draft.weekOf === weekAnchor) {
      data = draft.data;
      source = "draft";
    } else {
      // A live build touches availability and the forecast —
      // any of which can throw. Without this catch the run dies here and
      // leaves no trace at all, which is the failure mode this logging
      // exists to close.
      try {
        data = await buildWeeklyUpdateData(admin);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await recordWeeklyUpdateAttempt(admin, {
          weekOf: weekAnchor,
          triggeredBy,
          status: "failed",
          source: "live",
          recipientsCount: recipients.size,
          error: `Live build failed: ${message}`,
        });
        console.error("[WEEKLY-UPDATE] Live build failed:", err);
        return NextResponse.json(
          { success: false, error: `Could not build this week's update: ${message}` },
          { status: 500 },
        );
      }
      source = "live";
    }
  }

  const subject = `${testTo ? "[TEST] " : ""}Press Farm Weekly Update — Week of ${data.weekOfLabel}`;

  const fallbackText = [
    `PRESS FARM — WEEKLY UPDATE`,
    `Week of ${data.weekOfLabel}`,
    ``,
    ...(data.generalNote ? [`GENERAL:`, data.generalNote, ``] : []),
    ...(data.tasksCompleted.length > 0 || data.tasksUpcoming.length > 0
      ? [
          `=== AROUND THE FARM ===`,
          ...(data.tasksCompleted.length > 0
            ? [`Done this week:`, ...data.tasksCompleted.map((t) => `  ✓ ${t}`)]
            : []),
          ...(data.tasksUpcoming.length > 0
            ? [`On the list this week:`, ...data.tasksUpcoming.map((t) => `  - ${t}`)]
            : []),
          ``,
        ]
      : []),
    `=== ITEMS INCOMING ===`,
    ...data.incoming.map((g) => `  ${g.label}: ${g.items.length > 0 ? g.items.join(", ") : "—"}`),
    ``,
    `Order at ${process.env.NEXT_PUBLIC_APP_URL ?? "https://pressfarm.io"}/order`,
    `— Press Farm · Yountville, California`,
  ].join("\n");

  const { safeResendSend } = await import("@/lib/resend/client");
  const { FROM_ADDRESSES } = await import("@/lib/constants");
  const reactEl = WeeklyUpdate({
    weekOfLabel: data.weekOfLabel,
    generalNote: data.generalNote || null,
    incoming: data.incoming,
    tasksCompleted: data.tasksCompleted,
    tasksUpcoming: data.tasksUpcoming,
  }) as React.ReactElement;

  const list = Array.from(recipients);

  // Stamp the week as sent BEFORE the sends go out. Once a delayed slot is
  // reached, every later hourly run also decides "send" and the stamp is the
  // only thing stopping it — written after the sends, two runs could overlap
  // and the chefs got the update twice. A test send never stamps. If every
  // send fails the stamp is put back to what it was (see below).
  const priorStamp = settingsMap.weekly_update_last_sent_week || null;
  if (!testTo) {
    await upsertFarmSetting(admin, "weekly_update_last_sent_week", weekAnchor);
  }

  // ONE email addressed to the whole list, so everyone is on the same thread
  // and a reply-all reaches the group. The saved recipients are mostly group
  // addresses whose members overlap — a separate email per address meant
  // people in two groups got two unrelated copies. Resend caps `to` at 50
  // addresses per email, so a longer list goes out as consecutive groups.
  const sent: string[] = [];
  const failed: Array<{ to: string; error: string }> = [];
  for (let i = 0; i < list.length; i += MAX_TO_PER_EMAIL) {
    const group = list.slice(i, i + MAX_TO_PER_EMAIL);
    let error: string | null = null;
    try {
      const res = await safeResendSend({
        from: FROM_ADDRESSES.forecast,
        to: group,
        subject,
        text: fallbackText,
        react: reactEl,
      });
      if (res.error) error = res.error.message || "send failed";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    if (error) for (const to of group) failed.push({ to, error });
    else sent.push(...group);
  }
  if (failed.length > 0) console.error("[WEEKLY-UPDATE] Some sends failed:", failed);

  // A test send is not this week's update: no log row, no sent-week stamp.
  if (testTo) {
    return NextResponse.json({
      success: sent.length > 0,
      test: true,
      subject,
      source,
      to: sent,
      ...(failed.length > 0 ? { error: failed[0].error } : {}),
    });
  }

  // Durable record of the outcome. A console.error alone is invisible the
  // moment the Vercel log ages out — this row is what the watchdog and the
  // admin UI read to answer "did Monday's update go out?".
  await recordWeeklyUpdateAttempt(admin, {
    weekOf: weekAnchor,
    triggeredBy,
    status: sent.length === 0 ? "failed" : failed.length > 0 ? "partial" : "sent",
    source,
    recipientsCount: list.length,
    succeededCount: sent.length,
    failedCount: failed.length,
    error:
      failed.length > 0
        ? failed.map((f) => `${f.to}: ${f.error}`).join(" | ")
        : null,
  });

  // Total failure: nobody got it, so the week must not read as sent — put
  // the stamp back so the Monday cron (or a late slot) still tries, and the
  // watchdog still alerts. A partial send keeps the stamp: re-sending would
  // double up the chefs who did get it.
  if (sent.length === 0 && priorStamp !== weekAnchor) {
    await upsertFarmSetting(admin, "weekly_update_last_sent_week", priorStamp);
  }

  return NextResponse.json({
    success: sent.length > 0,
    subject,
    source,
    to: sent,
    ...(failed.length > 0
      ? { failed, error: `${failed.length} of ${list.length} sends failed` }
      : {}),
  });
}
