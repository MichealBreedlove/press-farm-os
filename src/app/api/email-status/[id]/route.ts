import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/email-status/[id]
 *
 * Looks up a Resend email by its send-id and returns the actual delivery
 * status. Resend's send API returns "sent" the moment it queues the email
 * for SMTP delivery; the real status (delivered, bounced, complained, etc.)
 * shows up in their dashboard a few seconds later. This endpoint pulls that
 * status directly so we can diagnose missing-email issues without bouncing
 * to the Resend UI.
 *
 * Admin only.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  // Call Resend's GET /emails/{id} directly. The Resend SDK has resend.emails.get(id)
  // but a raw fetch is fine and doesn't require importing the SDK.
  const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }

  return NextResponse.json({
    httpStatus: res.status,
    resendStatus: json?.last_event ?? json?.status ?? null,
    to: json?.to ?? null,
    from: json?.from ?? null,
    subject: json?.subject ?? null,
    created_at: json?.created_at ?? null,
    raw: json,
  });
}
