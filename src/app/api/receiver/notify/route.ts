import { NextResponse } from "next/server";
import React from "react";
import { render } from "@react-email/render";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { formatDeliveryDate } from "@/lib/utils";
import ReceiverDaily from "@/emails/receiver-daily";
import {
  buildReceiverBlocks,
  sendToReceivers,
  statusCountsFromBlocks,
} from "@/lib/receiver-notify";

export const maxDuration = 30;

/**
 * GET /api/receiver/notify?date=YYYY-MM-DD&preview=true
 *
 * Renders the receiver-daily email HTML for the given delivery date WITHOUT
 * sending it. Returns text/html so admin can preview the exact email body
 * the receiver will get. Mounts on the orders page as a "Preview" link.
 *
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const blocks = await buildReceiverBlocks(date);

  // ?format=json → return summary counts for the pre-send confirmation UI.
  // Default behaviour stays text/html so the existing Preview link works.
  if (url.searchParams.get("format") === "json") {
    const counts = blocks.reduce(
      (acc: any, b: any) => {
        for (const line of b.lines) acc[line.status]++;
        return acc;
      },
      { ready: 0, short: 0, pending: 0, extra: 0 } as Record<string, number>,
    );

    // Count active receivers so the UI can warn admin if there's nobody to send to.
    const admin2 = createAdminClient();
    const { count: receiverCount } = await (admin2 as any)
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "receiver")
      .eq("is_active", true);

    // Most recent send for this date — drives the re-send warning in the UI
    const { data: lastLog } = await (admin2 as any)
      .from("receiver_notify_log")
      .select("sent_at, succeeded_count, failed_count, fulfilled_orders_count")
      .eq("delivery_date", date)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      delivery_date: date,
      restaurants: blocks.length,
      lineCount: blocks.reduce((s: number, b: any) => s + b.lines.length, 0),
      counts,
      receiverCount: receiverCount ?? 0,
      lastSentAt: lastLog?.sent_at ?? null,
      lastSendSucceeded: lastLog?.succeeded_count ?? null,
      lastSendFailed: lastLog?.failed_count ?? null,
    });
  }

  const html = await render(
    ReceiverDaily({
      receiverName: "Admin (preview)",
      deliveryDate: formatDeliveryDate(date),
      restaurants: blocks,
    }) as React.ReactElement,
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// buildReceiverBlocks() lives in src/lib/receiver-notify.ts so the cron
// route can share it. See that file for the two-pass status computation.

/**
 * POST /api/receiver/notify
 * Body: { delivery_date: "YYYY-MM-DD", mark_fulfilled?: boolean }
 *
 * Builds the per-receiver "today's incoming" summary by joining orders +
 * deliveries for the given delivery date, computes ready/short/pending/extra
 * status per item (same logic as the /receiver dashboard), and emails every
 * active receiver.
 *
 * When mark_fulfilled = true (default) any orders for the date that aren't
 * already 'fulfilled' or 'cancelled' are flipped to 'fulfilled' BEFORE the
 * email is rendered — so the "Finish & Send" button closes pick-and-pack
 * and notifies the receiver in a single tap.
 *
 * Intended trigger: admin's "Finish & Send" button on the orders dashboard
 * after pick-and-pack is done with shortages annotated. Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let body: { delivery_date: string; mark_fulfilled?: boolean };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { delivery_date } = body;
  // Default to true — the button is "Finish & Send" so closing the orders
  // is the natural side effect. Pass false to send a heads-up without
  // moving the orders out of in-progress.
  const markFulfilled = body.mark_fulfilled !== false;

  if (!delivery_date || !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) {
    return NextResponse.json({ error: "delivery_date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Optionally close out any open orders for this date so they move to
  // 'fulfilled' status. Done BEFORE the data join so the email reflects
  // the post-finish state.
  //
  // Auto-fill quantity_fulfilled for any non-shorted line that's still NULL
  // — same fix the PATCH /api/orders/[orderId] handler applies. Without
  // this, lines admin never tapped (because they weren't shorted) stay at
  // NULL and the receiver email computes them as "pending" instead of
  // "ready" even though they'll be delivered in full.
  let fulfilledCount = 0;
  if (markFulfilled) {
    const { data: openOrders } = await (admin as any)
      .from("orders")
      .select("id")
      .eq("delivery_date", delivery_date)
      .not("status", "in", "(fulfilled,cancelled)");
    const ids = (openOrders ?? []).map((o: any) => o.id);
    if (ids.length > 0) {
      // 1. Auto-fill quantity_fulfilled = quantity_requested for non-shorted
      //    lines on these orders that don't have an explicit fulfilled qty.
      const { data: openLines } = await (admin as any)
        .from("order_items")
        .select("id, quantity_requested")
        .in("order_id", ids)
        .eq("is_shorted", false)
        .is("quantity_fulfilled", null);
      for (const line of (openLines ?? []) as Array<{ id: string; quantity_requested: number }>) {
        await (admin as any)
          .from("order_items")
          .update({ quantity_fulfilled: line.quantity_requested })
          .eq("id", line.id);
      }
      // 2. Then flip the orders to 'fulfilled'.
      const { error: fErr } = await (admin as any)
        .from("orders")
        .update({ status: "fulfilled" })
        .in("id", ids);
      if (!fErr) fulfilledCount = ids.length;
    }
  }

  // Build per-restaurant blocks via the shared two-pass status computation
  // (same helper the GET /preview path and the cron route use, so the
  // three send paths can never drift in how they read the data).
  const restaurantBlocks = await buildReceiverBlocks(delivery_date);
  if (restaurantBlocks.length === 0) {
    return NextResponse.json({
      error: "No orders or deliveries for this date — nothing to send",
    }, { status: 422 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const results = await sendToReceivers(delivery_date, restaurantBlocks);
  if (results.length === 0) {
    return NextResponse.json({ error: "No active receivers configured" }, { status: 404 });
  }

  const succeeded = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status !== "sent").length;
  const counts = statusCountsFromBlocks(restaurantBlocks);

  await (admin as any).from("receiver_notify_log").insert({
    delivery_date,
    sent_by: user.id,
    recipients_count: results.length,
    succeeded_count: succeeded,
    failed_count: failed,
    fulfilled_orders_count: fulfilledCount,
    ready_count: counts.ready,
    short_count: counts.short,
    pending_count: counts.pending,
    extra_count: counts.extra,
  });

  return NextResponse.json({
    delivery_date,
    sent_to: results.length,
    succeeded,
    failed,
    fulfilled_orders: fulfilledCount,
    results,
  });
}
