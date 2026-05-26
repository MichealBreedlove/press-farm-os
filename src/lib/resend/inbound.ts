/**
 * Resend Inbound webhook helpers.
 *
 * Resend signs inbound webhooks using the Svix format:
 *   Headers:
 *     svix-id:        unique message id
 *     svix-timestamp: unix timestamp (seconds)
 *     svix-signature: space-separated "v1,<base64-hmac>" entries
 *
 *   Signed payload string: `${svix_id}.${svix_timestamp}.${rawBody}`
 *   HMAC-SHA256 keyed with the secret bytes (base64-decoded after the
 *   `whsec_` prefix), output base64.
 *
 *   Multiple signatures may be present (during secret rotation). We accept
 *   the message if ANY signature matches.
 *
 * The signing secret is provisioned in the Resend dashboard when you
 * configure the inbound endpoint and stored in Vercel as
 * RESEND_INBOUND_SIGNING_SECRET.
 *
 * Reject timestamps more than 5 minutes from now in either direction —
 * defends against replay of an old signed body.
 */

import crypto from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export interface InboundHeaders {
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export function readInboundHeaders(headers: Headers): InboundHeaders {
  return {
    svixId: headers.get("svix-id"),
    svixTimestamp: headers.get("svix-timestamp"),
    svixSignature: headers.get("svix-signature"),
  };
}

export function verifyResendSignature(
  rawBody: string,
  headers: InboundHeaders,
  secret: string,
): VerifyResult {
  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
    return { ok: false, reason: "missing svix headers" };
  }

  const ts = Number(headers.svixTimestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(cleanSecret, "base64");
  } catch {
    return { ok: false, reason: "bad secret encoding" };
  }

  const signed = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signed)
    .digest("base64");

  // svix-signature is space-separated entries like "v1,<base64>"
  const candidates = headers.svixSignature
    .split(" ")
    .map((entry) => {
      const [version, sig] = entry.split(",");
      return version === "v1" ? sig : null;
    })
    .filter((s): s is string => Boolean(s));

  if (candidates.length === 0) {
    return { ok: false, reason: "no v1 signatures present" };
  }

  const expectedBuf = Buffer.from(expected, "base64");
  for (const candidate of candidates) {
    let candidateBuf: Buffer;
    try {
      candidateBuf = Buffer.from(candidate, "base64");
    } catch {
      continue;
    }
    if (candidateBuf.length !== expectedBuf.length) continue;
    if (crypto.timingSafeEqual(candidateBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "no signature matched" };
}

// ─── Payload typing ────────────────────────────────────────────────────
//
// Resend's inbound webhook delivers an event envelope. The payload shape
// below is intentionally permissive — different inbound providers shape
// fields slightly differently, and Resend's contract has been evolving.
// We pick out the fields we need and tolerate extras.

export interface InboundAddress {
  email: string;
  name?: string | null;
}

export interface InboundEmailPayload {
  message_id?: string;
  from: InboundAddress | { address: string; name?: string | null };
  to: Array<InboundAddress | { address: string; name?: string | null }>;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  in_reply_to?: string | null;
  created_at?: string | null;
}

export interface InboundEvent {
  type?: string;
  data?: InboundEmailPayload & { id?: string; message_id?: string };
  // Some providers post the email object directly without an envelope.
  // We handle both by reading either `data.*` or top-level fields.
  [key: string]: unknown;
}

interface NormalizedEmail {
  messageId: string;
  from: { email: string; name: string | null };
  to: Array<{ email: string; name: string | null }>;
  subject: string | null;
  text: string | null;
  html: string | null;
  inReplyTo: string | null;
  receivedAt: string;
}

function normalizeAddress(
  addr: InboundAddress | { address: string; name?: string | null } | null | undefined,
): { email: string; name: string | null } | null {
  if (!addr) return null;
  const email = "email" in addr ? addr.email : addr.address;
  if (!email) return null;
  const name = "name" in addr && addr.name ? addr.name : null;
  return { email, name };
}

/**
 * Pull the fields we care about out of an inbound event envelope.
 * Returns null if the payload is missing required fields.
 */
export function normalizeInboundEmail(event: InboundEvent): NormalizedEmail | null {
  const payload = (event.data ?? event) as InboundEmailPayload & { id?: string; message_id?: string };

  const messageId = payload.message_id ?? payload.id ?? null;
  if (!messageId) return null;

  const from = normalizeAddress(payload.from as any);
  if (!from) return null;

  const toList = Array.isArray(payload.to)
    ? (payload.to.map(normalizeAddress).filter(Boolean) as Array<{ email: string; name: string | null }>)
    : [];
  if (toList.length === 0) return null;

  return {
    messageId,
    from,
    to: toList,
    subject: payload.subject ?? null,
    text: payload.text ?? null,
    html: payload.html ?? null,
    inReplyTo: payload.in_reply_to ?? null,
    receivedAt: payload.created_at ?? new Date().toISOString(),
  };
}
