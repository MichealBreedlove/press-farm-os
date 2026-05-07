import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReceiverBlocks, sendToReceivers } from "@/lib/receiver-notify";

/**
 * POST /api/orders/send-to-receiver
 *
 * One-shot "I'm done picking" action from the unified pick page. For
 * the given delivery date, this:
 *   1. Bumps every 'submitted' or 'in_progress' order to 'in_progress'
 *      so the receiver dashboard shows them as the day's queue
 *      (idempotent — safe to call multiple times).
 *   2. Builds the receiver blocks (orders + shortages overlay) and
 *      emails the active receiver(s) the same daily handoff template
 *      the cron uses.
 *
 * Admin-only. Body: { date: "YYYY-MM-DD" }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Bump statuses. We only touch 'submitted' rows so re-sending after a
  // shortage edit doesn't undo a 'fulfilled' order — the receiver may
  // have already finished part of the day.
  const { error: statusErr, count: bumpedCount } = await (admin as any)
    .from("orders")
    .update({ status: "in_progress" }, { count: "exact" })
    .eq("delivery_date", date)
    .eq("status", "submitted");
  if (statusErr) {
    return NextResponse.json({ error: `Status update failed: ${statusErr.message}` }, { status: 500 });
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
    failures: failures.map((f) => ({ to: f.receiver, error: String(f.error ?? f.status) })),
    receivers_count: sendResults.length,
  });
}
