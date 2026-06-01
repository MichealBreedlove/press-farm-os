import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { render } from "@react-email/render";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeResendSend } from "@/lib/resend/client";
import { FROM_ADDRESSES, APP_URL } from "@/lib/constants";
import ChefWelcome from "@/emails/chef-welcome";
import React from "react";

/**
 * POST /api/users/[userId]/welcome
 * Sends a welcome email to an existing chef. The email points to /login and
 * explains they'll receive their password separately — it never embeds a
 * password or a magic link. Admin only.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  // Get chef info
  const { data: chef } = await admin
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
    // Always link to the /login page — never an embedded password or magic
    // link. Chefs sign in with their email + the password the farm shares with
    // them out-of-band. The /login page works on demand and never expires.
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
