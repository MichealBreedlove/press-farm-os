import { Resend } from "resend";

/**
 * Resend email client.
 * Server-side only — never expose RESEND_API_KEY to the browser.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);
