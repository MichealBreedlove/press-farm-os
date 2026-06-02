import { NextResponse } from "next/server";
import { ADMIN_EMAIL, FROM_ADDRESSES } from "@/lib/constants";
import { safeResendSend } from "@/lib/resend/client";

/**
 * POST /api/contact — public chef-inquiry form on /about.
 *
 * Unauthenticated by design (prospective chefs aren't signed in). Hardened
 * with a honeypot field + length caps rather than auth. Delivers the inquiry
 * to the Press Farm inbox via Resend, with the sender's address as Reply-To so
 * Micheal can reply straight from his mail client.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields. Pretend success so we don't tip them off.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = clip(body.name, 120);
  const email = clip(body.email, 200).toLowerCase();
  const restaurant = clip(body.restaurant, 160);
  const message = clip(body.message, 2000);

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Please fill in your name, email, and a message." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Messaging isn't configured yet — please email us directly." }, { status: 503 });
  }

  const subject = `New chef inquiry — ${name}`;
  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    restaurant ? `Restaurant: ${restaurant}` : null,
    "",
    message,
  ].filter((l) => l !== null);

  try {
    const { error } = await safeResendSend({
      from: FROM_ADDRESSES.noreply,
      to: ADMIN_EMAIL,
      replyTo: email,
      subject,
      text: lines.join("\n"),
    });
    if (error) {
      return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
