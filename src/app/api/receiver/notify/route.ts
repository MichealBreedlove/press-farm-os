import { NextResponse } from "next/server";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient } from "@/lib/resend/client";
import { FROM_ADDRESSES } from "@/lib/constants";
import { formatDeliveryDate } from "@/lib/utils";
import ReceiverDaily from "@/emails/receiver-daily";

export const maxDuration = 30;

/**
 * POST /api/receiver/notify
 * Body: { delivery_date: "YYYY-MM-DD" }
 *
 * Builds the per-receiver "today's incoming" summary by joining orders +
 * deliveries for the given delivery date, computes ready/short/pending/extra
 * status per item (same logic as the /receiver dashboard), and emails every
 * active receiver.
 *
 * Intended trigger: admin's "Finish & Send" button on the orders dashboard
 * after pick-and-pack is done with shortages annotated. Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { delivery_date: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { delivery_date } = body;
  if (!delivery_date || !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) {
    return NextResponse.json({ error: "delivery_date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Find every active receiver. They have no restaurant_users link, so we
  //    fetch them from profiles + auth emails directly.
  const { data: receiverProfiles } = await (admin as any)
    .from("profiles")
    .select("id, full_name")
    .eq("role", "receiver")
    .eq("is_active", true);

  if (!receiverProfiles?.length) {
    return NextResponse.json({ error: "No active receivers configured" }, { status: 404 });
  }

  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  // 2. Restaurants — exclude the legacy Events row (events are now an item tag)
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .not("name", "ilike", "%event%")
    .order("name");

  // 3. Orders for the date with full join down to items
  const { data: orders } = await (admin as any)
    .from("orders")
    .select(`
      id, restaurant_id, freeform_notes,
      order_items (
        id, quantity_requested, quantity_fulfilled, is_shorted, shortage_reason,
        availability_items (
          id, item_id,
          items ( id, name, unit_type, is_event_item )
        )
      )
    `)
    .eq("delivery_date", delivery_date);

  // 4. Deliveries for the date — for "extras" detection (delivered but not ordered)
  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select(`
      id, restaurant_id,
      delivery_items (
        id, item_id, quantity, unit,
        items ( id, name, unit_type, is_event_item )
      )
    `)
    .eq("delivery_date", delivery_date);

  // 5. Build per-restaurant blocks with computed status
  const restaurantBlocks = (restaurants ?? []).map((r: any) => {
    const order = (orders ?? []).find((o: any) => o.restaurant_id === r.id);
    const delivery = (deliveries ?? []).find((d: any) => d.restaurant_id === r.id);

    type Line = {
      itemName: string;
      unit: string;
      ordered: number;
      delivered: number;
      status: "ready" | "short" | "pending" | "extra";
      shortageReason?: string;
      isEvent?: boolean;
    };

    const linesByItem = new Map<string, Line>();

    // Pass 1: every ordered item starts as pending or short (per is_shorted flag)
    for (const oi of order?.order_items ?? []) {
      const item = oi.availability_items?.items;
      if (!item) continue;
      const ordered = Number(oi.quantity_requested ?? 0);
      const fulfilled = oi.quantity_fulfilled != null ? Number(oi.quantity_fulfilled) : null;
      const shorted = Boolean(oi.is_shorted);
      const unit = String(item.unit_type ?? "").split(",")[0]?.trim() ?? "";

      let status: Line["status"];
      if (shorted) status = "short";
      else if (fulfilled != null) status = "ready";
      else status = "pending";

      linesByItem.set(item.id, {
        itemName: item.name,
        unit,
        ordered,
        delivered: fulfilled ?? 0,
        status,
        shortageReason: oi.shortage_reason ?? undefined,
        isEvent: Boolean(item.is_event_item),
      });
    }

    // Pass 2: overlay logged delivery_items — confirms ready, surfaces extras,
    // and bumps short→short or pending→ready as appropriate.
    for (const di of delivery?.delivery_items ?? []) {
      const item = di.items;
      if (!item) continue;
      const delivered = Number(di.quantity ?? 0);
      const existing = linesByItem.get(item.id);
      const unit = String(di.unit ?? item.unit_type ?? "").split(",")[0]?.trim() ?? "";

      if (!existing) {
        linesByItem.set(item.id, {
          itemName: item.name,
          unit,
          ordered: 0,
          delivered,
          status: "extra",
          isEvent: Boolean(item.is_event_item),
        });
      } else {
        existing.delivered += delivered;
        if (existing.status === "pending") {
          existing.status = existing.delivered >= existing.ordered ? "ready" : "short";
        } else if (existing.status === "short" && existing.delivered >= existing.ordered) {
          existing.status = "ready";
          existing.shortageReason = undefined;
        }
      }
    }

    return {
      restaurantName: r.name,
      freeformNotes: order?.freeform_notes ?? undefined,
      lines: Array.from(linesByItem.values()),
    };
  }).filter((b: any) => b.lines.length > 0);

  if (restaurantBlocks.length === 0) {
    return NextResponse.json({
      error: "No orders or deliveries for this date — nothing to send",
    }, { status: 422 });
  }

  // 6. Render + send to every receiver
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const resend = getResendClient();
  const results: { receiver: string; status: string; id?: string; error?: any }[] = [];

  for (const recv of receiverProfiles as any[]) {
    const email = emailMap.get(recv.id);
    if (!email) continue;

    try {
      const { data: sendData, error } = await resend.emails.send({
        from: FROM_ADDRESSES.orders,
        to: email,
        subject: `Today's Receiving — ${formatDeliveryDate(delivery_date)}`,
        react: ReceiverDaily({
          receiverName: recv.full_name ?? "Receiver",
          deliveryDate: formatDeliveryDate(delivery_date),
          restaurants: restaurantBlocks,
        }) as React.ReactElement,
      });
      if (error) {
        results.push({ receiver: email, status: "failed", error });
      } else {
        results.push({ receiver: email, status: "sent", id: sendData?.id });
      }
    } catch (err: any) {
      results.push({ receiver: email, status: "exception", error: err?.message ?? String(err) });
    }
    // Pace at ~600ms to stay under Resend's 2 req/sec
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return NextResponse.json({
    delivery_date,
    sent_to: results.length,
    succeeded: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status !== "sent").length,
    results,
  });
}
