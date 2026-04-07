import { Resend } from "resend";

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
