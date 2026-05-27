/**
 * POST /api/inbound/reply
 *
 * Webhook endpoint for Resend Inbound ("Receiving"). Fires for every email
 * delivered to *@pressfarm.io. Each delivery is:
 *
 *   1. Signature-verified against RESEND_INBOUND_SIGNING_SECRET
 *   2. Normalized into metadata (Resend's webhook is metadata-only)
 *   3. Body fetched via GET /emails/receiving/{email_id} using RESEND_API_KEY
 *   4. Upserted into inbound_messages (idempotent by resend_message_id)
 *   5. Sender best-effort matched to a profile + restaurant
 *   6. Fire-and-forget LLM extraction (does not block the webhook ack)
 *
 * Always 200s after a successful upsert so Resend's retry queue doesn't
 * pile up. Signature failures get 401 so the operator notices a misconfig.
 * Body-fetch failures store the row WITHOUT body — extraction will skip,
 * but the metadata is preserved for manual review.
 *
 * Required env:
 *   RESEND_INBOUND_SIGNING_SECRET  — from Resend dashboard (whsec_...)
 *   RESEND_API_KEY                 — same key used for outbound; needed to
 *                                    fetch received-email bodies via API
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchReceivedEmail,
  normalizeInboundEvent,
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
  // Defined in migration 060. Best-effort: many senders won't match.
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
  const signingSecret = process.env.RESEND_INBOUND_SIGNING_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!signingSecret || !resendApiKey) {
    console.error(
      "[INBOUND] missing env: RESEND_INBOUND_SIGNING_SECRET or RESEND_API_KEY not set",
    );
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const headers = readInboundHeaders(req.headers);
  const verified = verifyResendSignature(rawBody, headers, signingSecret);
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

  const meta = normalizeInboundEvent(event);
  if (!meta) {
    console.warn("[INBOUND] could not normalize payload", { type: event.type });
    // Ack so Resend doesn't retry indefinitely on a payload we'll never handle.
    return NextResponse.json({ ok: true, skipped: "unrecognized payload" });
  }

  // Fetch the actual body (Resend's webhook only sends metadata)
  let textBody: string | null = null;
  let htmlBody: string | null = null;
  let fromName: string | null = null;
  let inReplyTo: string | null = null;
  try {
    const body = await fetchReceivedEmail(meta.emailId, resendApiKey);
    textBody = body.text;
    htmlBody = body.html;
    fromName = body.fromName;
    inReplyTo = body.inReplyTo;
  } catch (err) {
    // Store the row anyway — operator can fetch the body manually from the
    // Resend dashboard if needed. Extractor will skip on empty body.
    console.error("[INBOUND] body fetch failed; storing metadata only", {
      emailId: meta.emailId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  const admin = createAdminClient();

  // Resolve the single farm — Press Farm OS is single-tenant.
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id;
  if (!farmId) {
    console.error("[INBOUND] no farm row found — DB not seeded?");
    return NextResponse.json({ error: "farm missing" }, { status: 500 });
  }

  const matched = await matchSenderToProfile(admin, meta.from.email);

  // Idempotent upsert: same resend_message_id should never produce two rows.
  const { data: upserted, error: upsertErr } = await (admin as any)
    .from("inbound_messages")
    .upsert(
      {
        farm_id: farmId,
        resend_message_id: meta.messageId,
        from_email: meta.from.email,
        from_name: fromName,
        to_email: meta.to[0] ?? "replies@pressfarm.io",
        subject: meta.subject,
        text_body: textBody,
        html_body: htmlBody,
        in_reply_to: inReplyTo,
        matched_user_id: matched.user_id,
        matched_restaurant_id: matched.restaurant_id,
        received_at: meta.receivedAt,
      },
      { onConflict: "resend_message_id" },
    )
    .select("id, extraction_status")
    .single();

  if (upsertErr) {
    console.error("[INBOUND] upsert failed", upsertErr);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  // Synchronous extraction. Originally fire-and-forget (`void promise`) but
  // that gets killed when the serverless function returns — confirmed in
  // prod testing 2026-05-27, messages were stuck in extraction_status='pending'
  // until manually re-run. Next.js 14 has no `after()` so we just block on
  // the LLM call. Haiku 4.5 typically returns in ~3s, well under maxDuration:60
  // and Resend's webhook timeout. Catch errors so a failed extraction never
  // turns into a webhook 500 (Resend would retry and we'd double-upsert).
  // Only runs on the first ingest; idempotent retries skip if already processed.
  if (upserted.extraction_status === "pending") {
    try {
      await extractItemRequests({ inboundMessageId: upserted.id });
    } catch (err) {
      console.error("[INBOUND] extraction crashed", err);
    }
  }

  return NextResponse.json({ ok: true, id: upserted.id });
}
