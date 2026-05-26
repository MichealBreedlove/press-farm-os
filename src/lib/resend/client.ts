import { Resend } from "resend";
import { REPLY_TO_ADDRESS } from "@/lib/constants";

/**
 * Resend email client — lazy singleton.
 * Only instantiated when actually needed (avoids build-time throw on missing key).
 * Server-side only — never expose RESEND_API_KEY to the browser.
 */
let _resend: Resend | null = null;

export function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

/**
 * Recipient-override guard for safe testing.
 *
 * When EMAIL_OVERRIDE_TO is set, EVERY outbound email — test, weekly digest,
 * order confirmation, chef welcome, receiver daily, timesheet, anything —
 * is rerouted to that address regardless of the original recipient.
 *
 * The original `to`/`cc`/`bcc` value is preserved in:
 *   - the subject line, prefixed `[→ original@email] …`
 *   - the X-PF-Original-To header
 *   - a console.warn line per send
 *
 * Set EMAIL_OVERRIDE_TO=mikejohnbreedlove@gmail.com in Vercel (preview or
 * production env) or .env.local to inspect every email type without ever
 * delivering to real chefs/receivers. Unset to restore normal routing.
 *
 * Comma-separated values are supported (e.g. "me@x.com,me@y.com").
 */
type ResendSendArgs = Parameters<Resend["emails"]["send"]>;
type ResendSendPayload = ResendSendArgs[0];
type ResendSendOptions = ResendSendArgs[1];

function getOverride(): string[] | null {
  const raw = process.env.EMAIL_OVERRIDE_TO?.trim();
  if (!raw) return null;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : null;
}

function applyOverride(payload: ResendSendPayload): ResendSendPayload {
  const override = getOverride();
  if (!override) return payload;

  const collect = (v: string | string[] | undefined) =>
    v == null ? [] : Array.isArray(v) ? v : [v];

  const originals = [
    ...collect(payload.to),
    ...collect((payload as any).cc),
    ...collect((payload as any).bcc),
  ];
  const originalLabel = originals.length > 0 ? originals.join(", ") : "(none)";

  // Drop cc/bcc entirely — override mode should never page a real human.
  const overridden: ResendSendPayload = {
    ...payload,
    to: override,
    cc: undefined,
    bcc: undefined,
    subject: `[→ ${originalLabel}] ${payload.subject ?? ""}`,
    headers: {
      ...((payload as any).headers ?? {}),
      "X-PF-Original-To": originalLabel,
      "X-PF-Override-Reason": "EMAIL_OVERRIDE_TO env set",
    },
  } as ResendSendPayload;

  console.warn(
    `[EMAIL OVERRIDE] ${originalLabel} → ${override.join(", ")} | subject: ${payload.subject ?? ""}`,
  );

  return overridden;
}

/**
 * Default Reply-To on every outbound email unless a caller overrides it.
 *
 * Replies land at replies@pressfarm.io → Resend Inbound webhook →
 * POST /api/inbound/reply. Without this, chef replies to *@pressfarm.io
 * bounce or disappear silently because Resend's sender domains have no
 * inbound MX of their own.
 *
 * If a caller explicitly passes `replyTo` (even empty string), we respect it.
 */
function applyReplyTo(payload: ResendSendPayload): ResendSendPayload {
  if ("replyTo" in payload && payload.replyTo !== undefined) return payload;
  return { ...payload, replyTo: REPLY_TO_ADDRESS } as ResendSendPayload;
}

/**
 * Wrapper around `resend.emails.send` that applies EMAIL_OVERRIDE_TO when set
 * and stamps a default Reply-To header. Every outbound send in the app MUST
 * go through this helper — never call `getResendClient().emails.send` directly.
 */
export async function safeResendSend(
  payload: ResendSendPayload,
  options?: ResendSendOptions,
) {
  const final = applyOverride(applyReplyTo(payload));
  return getResendClient().emails.send(final, options);
}

/** True if EMAIL_OVERRIDE_TO is in effect for this process. */
export function isEmailOverrideActive(): boolean {
  return getOverride() !== null;
}

/** The override recipient list, or null. */
export function getEmailOverrideList(): string[] | null {
  return getOverride();
}
