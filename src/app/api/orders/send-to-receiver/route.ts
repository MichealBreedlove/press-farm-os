import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReceiverBlocks, sendToReceivers } from "@/lib/receiver-notify";
import { materializeDeliveryItems } from "@/lib/materialize-deliveries";

/**
 * POST /api/orders/send-to-receiver
 *
 * One-shot "I'm done picking" action from the unified pick page. For
 * the given delivery date, this:
 *   1. Auto-creates the financial paper trail — for each picked or
 *      shorted order_item that doesn't already have a matching
 *      delivery_items row, materialize one. The deliveries row is
 *      upserted on (date, restaurant). The deliveries.total_value
 *      trigger then auto-rolls up to the financial reports. A failure
 *      here aborts the whole action (500) — the day is not closed.
 *   2. Bumps every 'submitted' order to 'in_progress' so the receiver
 *      dashboard shows them as the day's queue.
 *   3. Sends the receiver-daily email with the same template the cron
 *      uses.
 *
 * Idempotent — safe to call multiple times. Existing delivery_items
 * are not duplicated; existing rows aren't overwritten so the receiver
 * can correct quantities mid-day. Once the receiver closes out the
 * delivery (status = 'finalized'), this endpoint will skip the
 * auto-create for that delivery to preserve the audit trail.
 *
 * Admin-only. Body: { date: "YYYY-MM-DD" }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const date = (body.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Auto-create delivery_items FIRST so the financial reports light up
  // without anyone visiting the legacy /admin/deliveries log page. If this
  // fails the day is NOT closed: nothing is bumped, no email goes out, and
  // the admin sees why. (Before 2026-10-27 a failed insert logged a line,
  // returned 0 and the day closed anyway — review §1.4.)
  const mat = await materializeDeliveryItems(admin, date);
  if (mat.failed) {
    console.error(`[send-to-receiver] delivery materialization failed for ${date}:`, mat.error);
    return NextResponse.json(
      {
        ok: false,
        error: "Could not record today's deliveries, so the day was NOT sent to the receiver. Nothing changed — try again.",
      },
      { status: 500 },
    );
  }
  const created = mat.created;

  // Bump statuses. We only touch 'submitted' rows so re-sending after a
  // shortage edit doesn't undo a 'fulfilled' order — the receiver may
  // have already finished part of the day.
  const { error: statusErr, count: bumpedCount } = await admin
    .from("orders")
    .update({ status: "in_progress" }, { count: "exact" })
    .eq("delivery_date", date)
    .eq("status", "submitted");
  if (statusErr) {
    console.error(`[send-to-receiver] status bump failed for ${date}:`, statusErr);
    return NextResponse.json({ ok: false, error: "Could not update the day's orders. Try again." }, { status: 500 });
  }

  // Build + send the receiver email. Falls back gracefully if no
  // active receivers exist — admin sees a clear message rather than
  // a silent no-op.
  const blocks = await buildReceiverBlocks(date);
  if (blocks.length === 0) {
    return NextResponse.json({
      ok: true,
      bumped: bumpedCount ?? 0,
      sent: 0,
      deliveryItemsCreated: created,
      delivery_items_created: created,
      ...(mat.warning ? { warning: mat.warning } : {}),
      message: "No orders for this date — nothing to send.",
    });
  }

  const sendResults = await sendToReceivers(date, blocks);
  const successes = sendResults.filter((r) => r.status === "sent").length;
  const failures = sendResults.filter((r) => r.status !== "sent");

  return NextResponse.json({
    ok: true,
    bumped: bumpedCount ?? 0,
    sent: successes,
    failed: failures.length,
    deliveryItemsCreated: created,
    delivery_items_created: created,
    ...(mat.warning ? { warning: mat.warning } : {}),
    failures: failures.map((f) => ({ to: f.receiver, error: String(f.error ?? f.status) })),
    receivers_count: sendResults.length,
  });
}
