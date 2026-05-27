/**
 * Resend Inbound (Receiving) webhook helpers.
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
 * configure the webhook and stored in Vercel as RESEND_INBOUND_SIGNING_SECRET.
 *
 * Reject timestamps more than 5 minutes from now in either direction —
 * defends against replay of an old signed body.
 *
 * ─── Payload shape ─────────────────────────────────────────────────────
 *
 * Resend's `email.received` webhook delivers METADATA ONLY — no body,
 * no headers, no attachments. We must call GET /emails/receiving/{id}
 * to fetch the actual content. The fetch helper at the bottom of this
 * file handles that.
 *
 * Webhook payload from docs (https://resend.com/docs/dashboard/receiving):
 *   {
 *     "type": "email.received",
 *     "created_at": "...",
 *     "data": {
 *       "email_id": "uuid",          // use this to fetch the body
 *       "created_at": "...",
 *       "from": "sender@example.com",
 *       "to": ["replies@pressfarm.io"],
 *       "cc": [], "bcc": [],
 *       "message_id": "<rfc-id>",
 *       "subject": "...",
 *       "attachments": [{...}]
 *     }
 *   }
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

export interface InboundEventData {
  email_id: string;
  created_at?: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  message_id?: string;
  subject?: string | null;
  attachments?: unknown[];
}

export interface InboundEvent {
  type?: string;
  created_at?: string;
  data?: InboundEventData;
}

export interface NormalizedInboundMetadata {
  /** Resend's UUID for this received email — used to fetch the body. */
  emailId: string;
  /** RFC Message-ID header value (often wrapped in <>) — falls back to emailId. */
  messageId: string;
  from: { email: string; name: string | null };
  to: string[];
  subject: string | null;
  receivedAt: string;
}

/**
 * Parse an `email.received` event envelope into the metadata we need to
 * (a) idempotently upsert the row and (b) fetch the body via the API.
 *
 * Returns null on any malformed/unsupported payload.
 */
export function normalizeInboundEvent(event: InboundEvent): NormalizedInboundMetadata | null {
  if (event.type && event.type !== "email.received") return null;
  const data = event.data;
  if (!data?.email_id || !data.from) return null;

  // Resend's payload puts `from` as a plain email string. If a friendly name
  // is ever needed it would come via the body-fetch headers, not the webhook.
  const fromEmail = typeof data.from === "string" ? data.from : null;
  if (!fromEmail) return null;

  const toList = Array.isArray(data.to) ? data.to.filter((s): s is string => typeof s === "string") : [];
  if (toList.length === 0) return null;

  return {
    emailId: data.email_id,
    messageId: data.message_id ?? data.email_id,
    from: { email: fromEmail, name: null },
    to: toList,
    subject: data.subject ?? null,
    receivedAt: data.created_at ?? event.created_at ?? new Date().toISOString(),
  };
}

// ─── Body fetch ────────────────────────────────────────────────────────
//
// Webhook payloads omit body/headers. We must follow up with a GET to
// /emails/receiving/{email_id} using the Resend API key to get the actual
// text/html so we can store + extract.
//
// API reference: https://resend.com/docs/api-reference/emails/retrieve-received-email

export interface FetchedEmailBody {
  text: string | null;
  html: string | null;
  fromName: string | null;
  inReplyTo: string | null;
}

interface ReceivedEmailResponse {
  object?: string;
  id?: string;
  from?: string;
  to?: string[];
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string> | null;
  message_id?: string | null;
}

/**
 * Best-effort plain-text fallback when Resend returns only HTML.
 * Crude tag strip — fine for LLM consumption; not safe to render as-is.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * GET /emails/receiving/{email_id}
 *
 * Returns the full body + a few useful header values, or throws on a
 * non-2xx response. Caller can decide whether to swallow.
 */
export async function fetchReceivedEmail(emailId: string, apiKey: string): Promise<FetchedEmailBody> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend receiving API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as ReceivedEmailResponse;

  const text = json.text ?? (json.html ? htmlToText(json.html) : null);

  // Headers come back as a flat object. Pull the friendly "From" name if
  // present (e.g. "Chef Phil <phil@pressnapavalley.com>" → "Chef Phil").
  let fromName: string | null = null;
  const fromHeader = json.headers?.from ?? json.headers?.From;
  if (fromHeader) {
    const match = fromHeader.match(/^\s*"?([^"<]+?)"?\s*</);
    if (match) fromName = match[1].trim() || null;
  }

  const inReplyTo = json.headers?.["in-reply-to"] ?? json.headers?.["In-Reply-To"] ?? null;

  return { text, html: json.html ?? null, fromName, inReplyTo };
}
