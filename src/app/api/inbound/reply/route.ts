/**
 * POST /api/inbound/reply
 *
 * Webhook endpoint for Resend Inbound. Configured to receive mail sent to
 * replies@pressfarm.io. Each delivery is:
 *
 *   1. Signature-verified against RESEND_INBOUND_SIGNING_SECRET
 *   2. Normalized into a NormalizedEmail
 *   3. Upserted into inbound_messages (idempotent by resend_message_id)
 *   4. Sender best-effort matched to a profile + restaurant
 *   5. Fire-and-forget LLM extraction (does not block the webhook ack)
 *
 * Always 200s after a successful upsert so Resend's retry queue doesn't
 * pile up. Signature failures get 401 so the operator notices a misconfig.
 *
 * Required env:
 *   RESEND_INBOUND_SIGNING_SECRET  — from Resend dashboard, format whsec_...
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeInboundEmail,
  readInboundHeaders,
  verifyResendSignature,
  type InboundEvent,
} from "@/lib/resend/inbound";
import { extractItemRequests } from "@/lib/extraction/item-requests";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface MatchedSender {
  user_id: string | null;
  restaurant_id: string | null;
}

async function matchSenderToProfile(
  admin: ReturnType<typeof createAdminClient>,
  senderEmail: string,
): Promise<MatchedSender> {
  // RPC reads auth.users (not in PostgREST) + restaurant_users in one shot.
  // Defined in migration 047. Best-effort: many senders won't match.
  const { data, error } = await (admin as any).rpc("match_inbound_sender", {
    p_email: senderEmail.trim(),
  });
  if (error) {
    console.warn("[INBOUND] sender match RPC failed", error);
    return { user_id: null, restaurant_id: null };
  }
  const row = Array.isArray(data) ? data[0] : null;
  return {
    user_id: row?.user_id ?? null,
    restaurant_id: row?.restaurant_id ?? null,
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_INBOUND_SIGNING_SECRET;
  if (!secret) {
    console.error("[INBOUND] RESEND_INBOUND_SIGNING_SECRET is not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const headers = readInboundHeaders(req.headers);
  const verified = verifyResendSignature(rawBody, headers, secret);
  if (!verified.ok) {
    console.warn("[INBOUND] signature rejected:", verified.reason);
    return NextResponse.json({ error: verified.reason ?? "invalid signature" }, { status: 401 });
  }

  let event: InboundEvent;
  try {
    event = JSON.parse(rawBody) as InboundEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = normalizeInboundEmail(event);
  if (!email) {
    console.warn("[INBOUND] could not normalize payload", { type: event.type });
    // Ack so Resend doesn't retry indefinitely on a malformed event we'd
    // never be able to handle anyway.
    return NextResponse.json({ ok: true, skipped: "unrecognized payload" });
  }

  const admin = createAdminClient();

  // Resolve the single farm — Press Farm OS is single-tenant.
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id;
  if (!farmId) {
    console.error("[INBOUND] no farm row found — DB not seeded?");
    return NextResponse.json({ error: "farm missing" }, { status: 500 });
  }

  const matched = await matchSenderToProfile(admin, email.from.email);

  // Idempotent upsert: same resend_message_id should never produce two rows.
  const { data: upserted, error: upsertErr } = await (admin as any)
    .from("inbound_messages")
    .upsert(
      {
        farm_id: farmId,
        resend_message_id: email.messageId,
        from_email: email.from.email,
        from_name: email.from.name,
        to_email: email.to[0]?.email ?? "replies@pressfarm.io",
        subject: email.subject,
        text_body: email.text,
        html_body: email.html,
        in_reply_to: email.inReplyTo,
        matched_user_id: matched.user_id,
        matched_restaurant_id: matched.restaurant_id,
        received_at: email.receivedAt,
      },
      { onConflict: "resend_message_id" },
    )
    .select("id, extraction_status")
    .single();

  if (upsertErr) {
    console.error("[INBOUND] upsert failed", upsertErr);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  // Fire-and-forget extraction. Only on the first ingest (skip if a retry
  // landed on an already-processed row).
  if (upserted.extraction_status === "pending") {
    void extractItemRequests({ inboundMessageId: upserted.id }).catch((err) => {
      console.error("[INBOUND] extraction crashed", err);
    });
  }

  return NextResponse.json({ ok: true, id: upserted.id });
}
