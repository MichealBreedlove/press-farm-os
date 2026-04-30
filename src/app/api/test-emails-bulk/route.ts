import { NextResponse } from "next/server";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/resend/client";
import { FROM_ADDRESSES, APP_URL } from "@/lib/constants";

import ChefWelcome from "@/emails/chef-welcome";
import AvailabilityPublished from "@/emails/availability-published";
import OrderConfirmation from "@/emails/order-confirmation";
import OrderReceived from "@/emails/order-received";
import OrderFulfilled from "@/emails/order-fulfilled";
import ShortageNotice from "@/emails/shortage-notice";

/**
 * GET /api/test-emails-bulk?to=email
 * Sends sample versions of all 6 transactional emails to the given address.
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? user.email ?? "";
  if (!to) return NextResponse.json({ error: "Missing ?to= param" }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const resend = getResendClient();
  const sampleDate = "Thursday, May 1";
  const results: { template: string; status: string; id?: string; error?: any }[] = [];

  // Helper
  async function send(template: string, fromAddress: string, subject: string, react: React.ReactElement) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to,
        subject: `[SAMPLE] ${subject}`,
        react,
      });
      if (error) {
        results.push({ template, status: "failed", error });
      } else {
        results.push({ template, status: "sent", id: data?.id });
      }
    } catch (err: any) {
      results.push({ template, status: "exception", error: err?.message ?? String(err) });
    }
  }

  // 1. Welcome
  await send(
    "chef-welcome",
    FROM_ADDRESSES.noreply,
    "Welcome to Press Farm",
    ChefWelcome({
      chefName: "Chef Sample",
      restaurantName: "Press",
      loginUrl: `${APP_URL}/login`,
    }) as React.ReactElement,
  );

  // 2. Availability published
  await send(
    "availability-published",
    FROM_ADDRESSES.availability,
    `New Availability — ${sampleDate}`,
    AvailabilityPublished({
      chefName: "Chef Sample",
      restaurantName: "Press",
      deliveryDate: sampleDate,
      itemCount: 28,
    }) as React.ReactElement,
  );

  // 3. Order confirmation (chef-facing)
  await send(
    "order-confirmation",
    FROM_ADDRESSES.orders,
    `Order Confirmed — ${sampleDate}`,
    OrderConfirmation({
      chefName: "Chef Sample",
      restaurantName: "Press",
      deliveryDate: sampleDate,
      freeformNotes: "Please send the smaller nasturtium leaves if available — doing a tasting menu Friday.",
      items: [
        { itemName: "Nasturtium", quantity: 200, unit: "ea" },
        { itemName: "Mustard Flowers", quantity: 2, unit: "qt" },
        { itemName: "Fava Flowers", quantity: 1, unit: "lg" },
        { itemName: "Pea Tendrils", quantity: 4, unit: "lg" },
        { itemName: "Squash Blossoms", quantity: 12, unit: "ea" },
        { itemName: "Mustard Greens", quantity: 2, unit: "lg" },
      ],
    }) as React.ReactElement,
  );

  // 4. Order received (admin notification)
  await send(
    "order-received",
    FROM_ADDRESSES.orders,
    `Press submitted order for ${sampleDate}`,
    OrderReceived({
      restaurantName: "Press",
      chefName: "Chef Sample",
      deliveryDate: sampleDate,
      submittedAt: "Wednesday 8:42 PM",
      freeformNotes: "Please send the smaller nasturtium leaves if available — doing a tasting menu Friday.",
      items: [
        { itemName: "Nasturtium", quantity: 200, unit: "ea" },
        { itemName: "Mustard Flowers", quantity: 2, unit: "qt" },
        { itemName: "Fava Flowers", quantity: 1, unit: "lg" },
        { itemName: "Pea Tendrils", quantity: 4, unit: "lg" },
        { itemName: "Squash Blossoms", quantity: 12, unit: "ea" },
        { itemName: "Mustard Greens", quantity: 2, unit: "lg" },
      ],
    }) as React.ReactElement,
  );

  // 5. Order fulfilled
  await send(
    "order-fulfilled",
    FROM_ADDRESSES.orders,
    `Order ready for ${sampleDate}`,
    OrderFulfilled({
      chefName: "Chef Sample",
      restaurantName: "Press",
      deliveryDate: sampleDate,
      items: [
        { itemName: "Nasturtium", requestedQty: 200, fulfilledQty: 200, unit: "ea", isShorted: false },
        { itemName: "Mustard Flowers", requestedQty: 2, fulfilledQty: 2, unit: "qt", isShorted: false },
        { itemName: "Fava Flowers", requestedQty: 1, fulfilledQty: 1, unit: "lg", isShorted: false },
        { itemName: "Squash Blossoms", requestedQty: 12, fulfilledQty: 8, unit: "ea", isShorted: true },
      ],
    }) as React.ReactElement,
  );

  // 6. Shortage notice
  await send(
    "shortage-notice",
    FROM_ADDRESSES.orders,
    `Shortage notice — ${sampleDate}`,
    ShortageNotice({
      chefName: "Chef Sample",
      restaurantName: "Press",
      deliveryDate: sampleDate,
      shortages: [
        { itemName: "Squash Blossoms", requestedQty: 12, fulfilledQty: 8, unit: "ea", reason: "Pest damage on three plants" },
        { itemName: "Borage Flowers", requestedQty: 50, fulfilledQty: 30, unit: "ea", reason: "Bolted early — replanting next week" },
      ],
    }) as React.ReactElement,
  );

  const summary = {
    sent_to: to,
    total: results.length,
    succeeded: results.filter(r => r.status === "sent").length,
    failed: results.filter(r => r.status !== "sent").length,
    results,
  };

  return NextResponse.json(summary);
}
