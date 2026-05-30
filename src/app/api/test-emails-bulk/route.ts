import { NextResponse } from "next/server";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { safeResendSend } from "@/lib/resend/client";
import { FROM_ADDRESSES, APP_URL } from "@/lib/constants";

// ~18 emails × 600ms throttle ≈ 11s of work (12 per-restaurant + receiver +
// 5 farm-level); bump the function's max runtime so we don't get cut off
// mid-batch on Vercel.
export const maxDuration = 30;

import ChefWelcome from "@/emails/chef-welcome";
import AvailabilityPublished from "@/emails/availability-published";
import OrderConfirmation from "@/emails/order-confirmation";
import OrderReceived from "@/emails/order-received";
import OrderFulfilled from "@/emails/order-fulfilled";
import ShortageNotice from "@/emails/shortage-notice";
import ReceiverDaily from "@/emails/receiver-daily";
import AvailabilityForecast from "@/emails/availability-forecast";
import EventRequestAccepted from "@/emails/event-request-accepted";
import WeeklyDigest from "@/emails/weekly-digest";
import LaborTimesheet from "@/emails/labor-timesheet";
import PartnerReport from "@/emails/partner-report";

/**
 * GET /api/test-emails-bulk?to=email&restaurant=Press
 *
 * Sends sample versions of every email template so each can be eyeballed for
 * correctness. The 6 transactional emails (welcome, availability, order
 * confirmation/received/fulfilled, shortage) are sent once per restaurant
 * (Press + Under-Study by default → 12 emails). The receiver-daily summary and
 * the 5 farm-level templates (forecast, event-request-accepted, weekly digest,
 * timesheet, partner report) are sent once each since they aren't restaurant-
 * scoped. Pass ?restaurant=Press to scope the per-restaurant set to one.
 *
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

  // Restaurant scope: ?restaurant=Press → just that one. Default → both.
  const restaurantParam = url.searchParams.get("restaurant");
  const restaurants = restaurantParam ? [restaurantParam] : ["Press", "Under-Study"];

  // ?only=receiver → skip the per-restaurant set and only fire the
  // receiver-daily summary. Use to isolate that template for testing.
  const onlyParam = url.searchParams.get("only");
  const skipPerRestaurant = onlyParam === "receiver";

  const sampleDate = "Thursday, May 1";
  const results: { template: string; restaurant: string; status: string; id?: string; error?: any }[] = [];

  async function send(template: string, restaurant: string, fromAddress: string, subject: string, react: React.ReactElement) {
    try {
      const { data, error } = await safeResendSend({
        from: fromAddress,
        to,
        subject: `[SAMPLE · ${restaurant}] ${subject}`,
        react,
      });
      if (error) {
        results.push({ template, restaurant, status: "failed", error });
      } else {
        results.push({ template, restaurant, status: "sent", id: data?.id });
      }
    } catch (err: any) {
      results.push({ template, restaurant, status: "exception", error: err?.message ?? String(err) });
    }
    // Resend's default rate limit is 2 requests/second. With 12 emails fired
    // sequentially the second restaurant's batch (esp. the order family)
    // hits 429 Too Many Requests and silently drops. Pace at ~600ms/send
    // to stay safely under the cap.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  // Send the full 6-template set for each requested restaurant.
  // Skipped when ?only=receiver so we can isolate the receiver email.
  for (const restaurant of skipPerRestaurant ? [] : restaurants) {
    // 1. Welcome
    await send(
      "chef-welcome",
      restaurant,
      FROM_ADDRESSES.noreply,
      "Welcome to Press Farm",
      ChefWelcome({
        chefName: "Chef Sample",
        restaurantName: restaurant,
        loginUrl: `${APP_URL}/login`,
      }) as React.ReactElement,
    );

    // 2. Availability published
    await send(
      "availability-published",
      restaurant,
      FROM_ADDRESSES.availability,
      `New Availability — ${sampleDate}`,
      AvailabilityPublished({
        chefName: "Chef Sample",
        restaurantName: restaurant,
        deliveryDate: sampleDate,
        itemCount: 28,
      }) as React.ReactElement,
    );

    // 3. Order confirmation (chef-facing)
    await send(
      "order-confirmation",
      restaurant,
      FROM_ADDRESSES.orders,
      `Order Confirmed — ${sampleDate}`,
      OrderConfirmation({
        chefName: "Chef Sample",
        restaurantName: restaurant,
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
      restaurant,
      FROM_ADDRESSES.orders,
      `${restaurant} submitted order for ${sampleDate}`,
      OrderReceived({
        restaurantName: restaurant,
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
      restaurant,
      FROM_ADDRESSES.orders,
      `Order ready for ${sampleDate}`,
      OrderFulfilled({
        chefName: "Chef Sample",
        restaurantName: restaurant,
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
      restaurant,
      FROM_ADDRESSES.orders,
      `Shortage notice — ${sampleDate}`,
      ShortageNotice({
        chefName: "Chef Sample",
        restaurantName: restaurant,
        deliveryDate: sampleDate,
        shortages: [
          { itemName: "Squash Blossoms", requestedQty: 12, fulfilledQty: 8, unit: "ea", reason: "Pest damage on three plants" },
          { itemName: "Borage Flowers", requestedQty: 50, fulfilledQty: 30, unit: "ea", reason: "Bolted early — replanting next week" },
        ],
      }) as React.ReactElement,
    );
  }

  // 7. Receiver daily summary — single email covering ALL restaurants
  // (only sent when restaurants param is unset OR includes both, so the
  // sample makes sense regardless of scope)
  await send(
    "receiver-daily",
    "Both",
    FROM_ADDRESSES.orders,
    `Today's Receiving — ${sampleDate}`,
    ReceiverDaily({
      receiverName: "Sample Receiver",
      deliveryDate: sampleDate,
      restaurants: [
        {
          restaurantName: "Press",
          freeformNotes: "Please send the smaller nasturtium leaves if available — doing a tasting menu Friday.",
          lines: [
            // Mix of statuses so the receiver email demonstrates all four pills
            { itemName: "Nasturtium",      ordered: 200, delivered: 200, unit: "ea", status: "ready" },
            { itemName: "Mustard Flowers", ordered: 2,   delivered: 2,   unit: "qt", status: "ready" },
            { itemName: "Squash Blossoms", ordered: 12,  delivered: 8,   unit: "ea", status: "short", shortageReason: "Pest damage on three plants" },
            { itemName: "Fava Flowers",    ordered: 1,   delivered: 1,   unit: "lg", status: "ready" },
            { itemName: "Pea Tendrils",    ordered: 4,   delivered: 4,   unit: "lg", status: "ready" },
            { itemName: "Mustard Greens",  ordered: 2,   delivered: 0,   unit: "lg", status: "pending" },
            { itemName: "Marigolds",       ordered: 0,   delivered: 12,  unit: "ea", status: "extra" },
            { itemName: "Pansy Petals",    ordered: 1,   delivered: 1,   unit: "pt", status: "ready", isEvent: true },
            { itemName: "Borage Flowers",  ordered: 50,  delivered: 30,  unit: "ea", status: "short", shortageReason: "Bolted early — replanting next week", isEvent: true },
          ],
        },
        {
          restaurantName: "Under-Study",
          freeformNotes: undefined,
          lines: [
            { itemName: "Calendula",    ordered: 1,  delivered: 1,  unit: "qt", status: "ready" },
            { itemName: "Pea Tendrils", ordered: 2,  delivered: 2,  unit: "lg", status: "ready" },
            { itemName: "Marigold",     ordered: 24, delivered: 24, unit: "ea", status: "ready" },
            { itemName: "Chamomile",    ordered: 100, delivered: 100, unit: "ea", status: "ready", isEvent: true },
          ],
        },
      ],
    }) as React.ReactElement,
  );

  // ── Farm-level templates — not restaurant-scoped, sent once each ──────

  // 8. Availability forecast (forward-looking, chef-facing)
  await send(
    "availability-forecast",
    "All",
    FROM_ADDRESSES.forecast,
    "Looking ahead — what's coming from the farm",
    AvailabilityForecast({
      chefName: "Chef Sample",
      restaurantName: "Press",
      asOfDate: sampleDate,
      sections: [
        {
          title: "Available Now",
          caption: "Harvesting this week",
          entries: [
            { name: "Nasturtium", category: "herbs_leaves", isMicrogreen: false, estimate: "plenty" },
            { name: "Borage Flowers", category: "flowers", isMicrogreen: false, estimate: "2–3 flats" },
            { name: "Pea Shoots", category: "micros_leaves", isMicrogreen: true, estimate: "12 clamshells" },
          ],
        },
        {
          title: "In ~2 Weeks",
          caption: "Sizing up now",
          entries: [
            { name: "Zinnia", category: "flowers", isMicrogreen: false, window: "opens mid-June" },
            { name: "Cherry Tomatoes", category: "fruit_veg", isMicrogreen: false, window: "first pick ~Jun 16" },
          ],
        },
      ],
    }) as React.ReactElement,
  );

  // 9. Event request accepted (chef-facing)
  await send(
    "event-request-accepted",
    "All",
    FROM_ADDRESSES.availability,
    "Your event request is confirmed",
    EventRequestAccepted({
      chefName: "Chef Sample",
      restaurantName: "Press",
      deliveryDate: sampleDate,
      items: [
        { itemName: "Edible Flower Mix", quantity: 6, unit: "clamshell" },
        { itemName: "Micro Herb Selection", quantity: 4, unit: "clamshell" },
      ],
      eventName: "Harvest Dinner — Private",
      adminResponse: "All set for that date. I'll bring the flower mix in two deliveries so it stays fresh.",
    }) as React.ReactElement,
  );

  // 10. Weekly digest (admin-facing)
  await send(
    "weekly-digest",
    "All",
    FROM_ADDRESSES.digest,
    "Press Farm — your week in review",
    WeeklyDigest({
      startLabel: "May 24",
      endLabel: "May 30",
      aiIntro: "Steady week. Three deliveries landed on plan and labor held under budget despite the Saturday double-header.",
      totalRevenue: "$1,842.00",
      totalExpenses: "$214.50",
      totalLaborHours: "31.5",
      totalLaborCost: "$472.50",
      netLabel: "$1,155.00",
      deliveryCount: 3,
      deliveries: [
        { dateLabel: "Thu, May 28", restaurantName: "Press", value: "$612.00" },
        { dateLabel: "Sat, May 30", restaurantName: "Press", value: "$734.00" },
        { dateLabel: "Sat, May 30", restaurantName: "Under-Study", value: "$496.00" },
      ],
      expenses: [
        { category: "Seeds & Starts", amount: "$128.00", description: "Zinnia + cosmos seed restock" },
        { category: "Supplies", amount: "$86.50", description: "Clamshells, rubber bands" },
      ],
      workers: [
        { name: "Micheal", hours: "18.0" },
        { name: "Field Helper", hours: "13.5" },
      ],
    }) as React.ReactElement,
  );

  // 11. Labor timesheet (supervisor-facing)
  await send(
    "labor-timesheet",
    "All",
    FROM_ADDRESSES.timesheet,
    "Timesheet for week of May 24",
    LaborTimesheet({
      weekLabel: "May 24",
      days: [
        {
          dateLabel: "Thursday, May 28",
          workers: [
            { name: "Micheal", tail: "6:30 - 10:00, 10:30 - 3:00", notes: "Harvest + Press delivery" },
            { name: "Field Helper", tail: "7:00 - 12:00" },
          ],
        },
        {
          dateLabel: "Saturday, May 30",
          workers: [
            { name: "Micheal", tail: "6:00 - 11:30", notes: "Double delivery day" },
          ],
        },
      ],
      signOff: "Micheal Breedlove",
    }) as React.ReactElement,
  );

  // 12. Partner report (partner-facing, e.g. Chef Phil)
  await send(
    "partner-report",
    "All",
    FROM_ADDRESSES.partnerReport,
    "Press Farm — your monthly partner report",
    PartnerReport({
      partnerName: "Phil",
      period: "monthly",
      periodLabel: "May 2026",
      totalValue: "$7,284.00",
      deliveryCount: 13,
      topItems: [
        { label: "Nasturtium", value: "$1,120.00", sub: "2,800 ea" },
        { label: "Squash Blossoms", value: "$864.00", sub: "1,440 ea" },
        { label: "Borage Flowers", value: "$612.00", sub: "34 lg" },
      ],
      byRestaurant: [
        { label: "Press", value: "$4,910.00", sub: "8 deliveries" },
        { label: "Under-Study", value: "$2,374.00", sub: "5 deliveries" },
      ],
      comingSoon: [
        { name: "Zinnia", category: "flowers", isMicrogreen: false, window: "opens mid-June" },
        { name: "Cherry Tomatoes", category: "fruit_veg", isMicrogreen: false, window: "first pick ~Jun 16" },
      ],
    }) as React.ReactElement,
  );

  const summary = {
    sent_to: to,
    restaurants,
    total: results.length,
    succeeded: results.filter(r => r.status === "sent").length,
    failed: results.filter(r => r.status !== "sent").length,
    results,
  };

  return NextResponse.json(summary);
}
