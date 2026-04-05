import { Resend } from "resend";

/**
 * Resend email client — lazy initialization to avoid build errors when
 * RESEND_API_KEY is not set (e.g. during `next build`).
 */
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "");
  }
  return _resend;
}

/** @deprecated Use getResend() instead */
export const resend = {
  emails: {
    send: (...args: Parameters<Resend["emails"]["send"]>) => getResend().emails.send(...args),
  },
};
