import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReceiverBlocks, sendToReceivers, statusCountsFromBlocks } from "@/lib/receiver-notify";

export const maxDuration = 30;

/**
 * GET /api/cron/receiver-notify
 *
 * Safety-net auto-send for the receiver email. Designed to be triggered by
 * Vercel Cron once a day (config in vercel.json). Behaviour:
 *
 *   1. Compute "today" in America/Los_Angeles (the farm's local TZ)
 *   2. Bail if today isn't a delivery_date (Mon/Thu/Sat normally)
 *   3. Bail if a notify already happened today (admin already tapped
 *      "Finish & Send" — don't double-send)
 *   4. Otherwise send the receiver-daily email to every active receiver,
 *      reflecting whatever shortages/extras have been logged so far,
 *      and write a row to receiver_notify_log
 *
 * This is intentionally idempotent — running it twice in the same day is
 * a no-op the second time.
 *
 * Auth: validates Vercel's CRON_SECRET via Authorization header. Set
 * CRON_SECRET in Vercel env vars; Vercel cron will pass it automatically.
 */
export async function GET(request: Request) {
  // Auth gate — Bearer ${CRON_SECRET}. Fail-closed in production: a missing
  // CRON_SECRET in a deployed environment is treated as a misconfiguration,
  // not as "anyone can fire this." Local dev is the only place where unset
  // CRON_SECRET allows access (so npm run dev curl-tests still work).
  const expected = process.env.CRON_SECRET;
  const isProd = process.env.VERCEL_ENV === "production"
    || process.env.NODE_ENV === "production";
  if (!expected) {
    if (isProd) {
      return NextResponse.json(
        { error: "Misconfigured: CRON_SECRET not set in production" },
        { status: 500 },
      );
    }
    // dev/local: allow through
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Today's date in America/Los_Angeles — the farm's TZ. Using
  // toLocaleDateString with the timezone option keeps DST changes correct.
  const todayLA = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  }); // "en-CA" yields YYYY-MM-DD

  const admin = createAdminClient();

  // 1. Is today a delivery date?
  const { data: deliveryDateRow } = await (admin as any)
    .from("delivery_dates")
    .select("date")
    .eq("date", todayLA)
    .maybeSingle();
  if (!deliveryDateRow) {
    return NextResponse.json({
      ok: true,
      action: "skipped",
      reason: "not a delivery date",
      date: todayLA,
    });
  }

  // 2. Already notified today?
  const { count: existingNotifyCount } = await (admin as any)
    .from("receiver_notify_log")
    .select("id", { count: "exact", head: true })
    .eq("delivery_date", todayLA);
  if ((existingNotifyCount ?? 0) > 0) {
    return NextResponse.json({
      ok: true,
      action: "skipped",
      reason: "already notified",
      date: todayLA,
    });
  }

  // 3. Build blocks; bail if there's nothing to send
  const blocks = await buildReceiverBlocks(todayLA);
  if (blocks.length === 0) {
    return NextResponse.json({
      ok: true,
      action: "skipped",
      reason: "no orders or deliveries",
      date: todayLA,
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  // 4. Send + log
  const results = await sendToReceivers(todayLA, blocks);
  const succeeded = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status !== "sent").length;
  const counts = statusCountsFromBlocks(blocks);

  // Find a "system" sender id — first admin in the table — so the
  // receiver_notify_log row has a non-null sent_by FK.
  const { data: anyAdmin } = await (admin as any)
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (anyAdmin) {
    await (admin as any).from("receiver_notify_log").insert({
      delivery_date: todayLA,
      sent_by: anyAdmin.id,
      recipients_count: results.length,
      succeeded_count: succeeded,
      failed_count: failed,
      fulfilled_orders_count: 0, // cron doesn't auto-fulfill — that's manual only
      ready_count: counts.ready,
      short_count: counts.short,
      pending_count: counts.pending,
      extra_count: counts.extra,
    });
  }

  return NextResponse.json({
    ok: true,
    action: "sent",
    date: todayLA,
    sent_to: results.length,
    succeeded,
    failed,
  });
}
