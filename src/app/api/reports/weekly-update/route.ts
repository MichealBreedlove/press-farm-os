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
  type WeeklyUpdateData,
} from "@/lib/weekly-update";
import WeeklyUpdate from "@/emails/weekly-update";

/**
 * Chef-facing "Press Farm – Weekly Update" email.
 *
 *   GET  — Vercel Cron trigger (Monday mornings). Requires
 *          `Authorization: Bearer ${CRON_SECRET}`; fail-closed in production.
 *          Sends the saved draft when one exists for this week (so admin
 *          edits go out verbatim), otherwise builds from live data. Skips
 *          entirely if this week's update was already sent manually.
 *   POST — Manual admin trigger from /admin/weekly-update. An optional
 *          `data` body sends exactly that (edited) content; without it the
 *          same draft-then-live resolution as the cron applies.
 *
 * Recipients: ONLY the addresses stored comma-separated in
 * farm_settings.weekly_update_recipients — chosen per-person on
 * /admin/weekly-update (chefs are offered as a picker but are not
 * auto-included).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected) {
    if (authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed: a production deploy without CRON_SECRET must not be callable.
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  return sendWeeklyUpdate({ isCron: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const edited = sanitizeWeeklyUpdateData(body?.data);
  return sendWeeklyUpdate({ isCron: false, edited });
}

async function sendWeeklyUpdate({
  isCron,
  edited,
}: {
  isCron: boolean;
  edited?: WeeklyUpdateData | null;
}) {
  const admin = createAdminClient();
  const weekAnchor = upcomingMondayISO();

  // ---- Settings: recipients + saved draft + last-sent guard --------------
  const { data: settingRows } = await (admin as any)
    .from("farm_settings")
    .select("key, value")
    .in("key", ["weekly_update_recipients", "weekly_update_draft", "weekly_update_last_sent_week"]);
  const settingsMap: Record<string, string> = {};
  for (const row of settingRows ?? []) settingsMap[row.key] = row.value ?? "";

  const triggeredBy = isCron ? "cron" : "manual";

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

  // ---- Recipients: exactly the saved list, nobody else -------------------
  const recipients = new Set<string>();
  for (const entry of (settingsMap.weekly_update_recipients ?? "").split(",")) {
    const email = entry.trim().toLowerCase();
    if (email) recipients.add(email);
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
      // A live build touches availability, planter boxes and the forecast —
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

  const subject = `Press Farm Weekly Update — Week of ${data.weekOfLabel}`;

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
    `=== AVAILABLE NOW ===`,
    ...(data.availableNow.length > 0
      ? data.availableNow.map((r) => `  ${r.name} — ${r.qty}${r.size && r.size !== "—" ? ` — ${r.size}` : ""}${r.notes ? ` (${r.notes})` : ""}`)
      : ["  Availability not yet published — check the order form."]),
    ``,
    ...(data.planterBeds.length > 0
      ? [`=== RESTAURANT PLANTER BEDS ===`, ...data.planterBeds.map((r) => `  ${r.name} — ${r.bed} — planted ${r.planted}${r.notes ? ` (${r.notes})` : ""}`), ``]
      : []),
    ...(data.gaps.length > 0
      ? [`=== GAPS OR LIMITED SUPPLY ===`, ...data.gaps.map((r) => `  ${r.name} — last wk: ${r.lastWeek} — back: ${r.backWhen}`), ``]
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
    availableNow: data.availableNow,
    planterBeds: data.planterBeds,
    gaps: data.gaps,
    incoming: data.incoming,
    tasksCompleted: data.tasksCompleted,
    tasksUpcoming: data.tasksUpcoming,
  }) as React.ReactElement;

  const list = Array.from(recipients);
  const sendResults = await Promise.allSettled(
    list.map((to) =>
      safeResendSend({
        from: FROM_ADDRESSES.forecast,
        to,
        subject,
        text: fallbackText,
        react: reactEl,
      }).then((res) => {
        if (res.error) throw new Error(res.error.message);
      }),
    ),
  );

  const sent: string[] = [];
  const failed: Array<{ to: string; error: string }> = [];
  sendResults.forEach((r, i) => {
    if (r.status === "fulfilled") sent.push(list[i]);
    else failed.push({ to: list[i], error: String(r.reason) });
  });
  if (failed.length > 0) console.error("[WEEKLY-UPDATE] Some sends failed:", failed);

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

  // Stamp the sent week so the Monday cron doesn't re-send after a manual send.
  if (sent.length > 0) {
    const { data: farmRow } = await admin.from("farms").select("id").limit(1).single();
    if (farmRow?.id) {
      await (admin as any)
        .from("farm_settings")
        .upsert(
          { farm_id: farmRow.id, key: "weekly_update_last_sent_week", value: weekAnchor },
          { onConflict: "farm_id,key" },
        );
    }
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
