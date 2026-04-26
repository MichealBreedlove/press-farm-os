import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FROM_EMAIL } from "@/lib/constants";

/**
 * GET /api/test-email?to=email@example.com
 * Diagnostic endpoint to test Resend configuration.
 * Returns the actual Resend API response (success or error).
 *
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? user.email ?? "";
  if (!to) {
    return NextResponse.json({ error: "Missing ?to= param" }, { status: 400 });
  }

  // Diagnostic info
  const diagnostics = {
    has_resend_api_key: Boolean(process.env.RESEND_API_KEY),
    api_key_prefix: process.env.RESEND_API_KEY?.slice(0, 6) ?? "(missing)",
    api_key_length: process.env.RESEND_API_KEY?.length ?? 0,
    from_email_env: process.env.RESEND_FROM_EMAIL ?? "(not set)",
    from_email_constant: FROM_EMAIL,
    will_use_from: process.env.RESEND_FROM_EMAIL || FROM_EMAIL,
    to_email: to,
  };

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      success: false,
      diagnostics,
      error: "RESEND_API_KEY not set in environment variables",
    });
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromAddress = process.env.RESEND_FROM_EMAIL || FROM_EMAIL;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject: "Press Farm OS — Test Email",
      text: `This is a test email from Press Farm OS.\n\nIf you received this, your email configuration is working.\n\nFrom: ${fromAddress}\nTo: ${to}\nTime: ${new Date().toISOString()}\n\n— Press Farm OS`,
    });

    if (error) {
      return NextResponse.json({
        success: false,
        diagnostics,
        resend_error: error,
        message: "Resend rejected the request — see resend_error for details",
      });
    }

    return NextResponse.json({
      success: true,
      diagnostics,
      email_id: data?.id,
      message: `Email sent! Check inbox for ${to}. If you don't see it, check spam folder.`,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      diagnostics,
      exception: err?.message ?? String(err),
      stack: err?.stack,
    });
  }
}
