/**
 * Press Farm OS — Receiver-notify shared helpers.
 *
 * Both the manual admin trigger (POST /api/receiver/notify) and the cron
 * safety net (GET /api/cron/receiver-notify) use the same data model and
 * send pipeline. Centralized here so the two paths can never drift in
 * how they compute the receiver's view.
 */

import React from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient } from "@/lib/resend/client";
import { FROM_ADDRESSES } from "@/lib/constants";
import { formatDeliveryDate } from "@/lib/utils";
import ReceiverDaily from "@/emails/receiver-daily";

export type ReceiverLineStatus = "ready" | "short" | "pending" | "extra";

export interface ReceiverLine {
  itemName: string;
  unit: string;
  ordered: number;
  delivered: number;
  status: ReceiverLineStatus;
  shortageReason?: string;
  isEvent?: boolean;
}

export interface ReceiverBlock {
  restaurantName: string;
  freeformNotes?: string;
  lines: ReceiverLine[];
}

/**
 * Two-pass status computation: same model as the /receiver dashboard.
 *   - Pass 1: every order_item starts as ready / short / pending based on
 *     quantity_fulfilled + is_shorted
 *   - Pass 2: overlay delivery_items — confirms ready, surfaces extras
 *     (delivered without an order line), and upgrades pending → ready/short
 *     when delivery is logged
 *
 * Excludes the legacy "Events" pseudo-restaurant; events are now an
 * is_event_item flag on items.
 */
export async function buildReceiverBlocks(delivery_date: string): Promise<ReceiverBlock[]> {
  const admin = createAdminClient();

  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .not("name", "ilike", "%event%")
    .order("name");

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

  return (restaurants ?? []).map((r: any) => {
    const order = (orders ?? []).find((o: any) => o.restaurant_id === r.id);
    const delivery = (deliveries ?? []).find((d: any) => d.restaurant_id === r.id);

    const linesByItem = new Map<string, ReceiverLine>();

    for (const oi of order?.order_items ?? []) {
      const item = oi.availability_items?.items;
      if (!item) continue;
      const ordered = Number(oi.quantity_requested ?? 0);
      const fulfilled = oi.quantity_fulfilled != null ? Number(oi.quantity_fulfilled) : null;
      const shorted = Boolean(oi.is_shorted);
      const unit = String(item.unit_type ?? "").split(",")[0]?.trim() ?? "";

      let status: ReceiverLineStatus;
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
  }).filter((b: ReceiverBlock) => b.lines.length > 0);
}

/** Aggregate ready/short/pending/extra counts across all blocks. */
export function statusCountsFromBlocks(blocks: ReceiverBlock[]) {
  return blocks.reduce(
    (acc, b) => {
      for (const line of b.lines) acc[line.status]++;
      return acc;
    },
    { ready: 0, short: 0, pending: 0, extra: 0 } as Record<ReceiverLineStatus, number>,
  );
}

interface SendResult {
  receiver: string;
  status: "sent" | "failed" | "exception";
  id?: string;
  error?: any;
}

/**
 * Send the receiver-daily email to every active receiver. Throttled at
 * 600ms to stay under Resend's 2 req/sec limit.
 */
export async function sendToReceivers(
  delivery_date: string,
  blocks: ReceiverBlock[],
): Promise<SendResult[]> {
  const admin = createAdminClient();

  const { data: receiverProfiles } = await (admin as any)
    .from("profiles")
    .select("id, full_name")
    .eq("role", "receiver")
    .eq("is_active", true);

  const profiles = (receiverProfiles ?? []) as Array<{ id: string; full_name: string | null }>;
  if (profiles.length === 0) return [];

  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  const resend = getResendClient();
  const results: SendResult[] = [];

  for (const recv of profiles) {
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
          restaurants: blocks,
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
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return results;
}
