import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeResendSend } from "@/lib/resend/client";
import { FROM_ADDRESSES, APP_URL } from "@/lib/constants";
import ChefWelcome from "@/emails/chef-welcome";
import React from "react";

/**
 * POST /api/users/[userId]/welcome
 * Sends a welcome email to an existing chef + magic link.
 * Admin only.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get chef info
  const { data: chef } = await (admin as any)
    .from("profiles")
    .select(`
      id, full_name,
      restaurant_users ( restaurants ( name ) )
    `)
    .eq("id", userId)
    .single();

  if (!chef) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get email from auth
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (!email) return NextResponse.json({ error: "User has no email" }, { status: 400 });

  const restaurantName = chef.restaurant_users?.[0]?.restaurants?.name ?? "your restaurant";

  // Render and send
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  try {
    // Always link to the /login page — never an embedded magic-link URL.
    // Magic-link OTPs from generateLink() expire in 1 hour, are one-shot, and
    // get consumed by mail-security scanners (Outlook SafeLinks, gmail preview)
    // before the chef even sees the email. The /login page lets the chef
    // request a fresh magic link on demand, which is reliable.
    const reactEl = ChefWelcome({
      chefName: chef.full_name ?? "Chef",
      restaurantName,
      loginUrl: `${APP_URL}/login`,
    }) as React.ReactElement;

    const { data: sendData, error: sendErr } = await safeResendSend({
      from: FROM_ADDRESSES.noreply,
      to: email,
      subject: `Welcome to Press Farm 🌿`,
      react: reactEl,
    });

    if (sendErr) {
      return NextResponse.json({ error: sendErr.message ?? "Send failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, email_id: sendData?.id, sent_to: email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
