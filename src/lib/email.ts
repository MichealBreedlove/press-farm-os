/**
 * Press Farm OS — Email helper
 *
 * Wraps Resend with a graceful console.log fallback when RESEND_API_KEY is not set.
 * Email errors never fail the API response — they are caught and logged.
 */

import { render } from "@react-email/render";
import { safeResendSend } from "@/lib/resend/client";
import { ADMIN_EMAIL, FROM_EMAIL, FROM_ADDRESSES } from "@/lib/constants";
import OrderReceived from "@/emails/order-received";
import OrderConfirmation from "@/emails/order-confirmation";
import OrderFulfilled from "@/emails/order-fulfilled";
import ShortageNotice from "@/emails/shortage-notice";
import EventRequestAccepted from "@/emails/event-request-accepted";
import AvailabilityPublished from "@/emails/availability-published";
import AvailabilityForecast, { type ForecastEmailSection, type ForecastEmailEntry } from "@/emails/availability-forecast";
import PartnerReport, { type PartnerReportLine } from "@/emails/partner-report";

// ---- Types ----

export interface OrderSubmittedEmailParams {
  restaurantName: string;
  chefName: string;
  deliveryDate: string;
  items: { itemName: string; quantity: number; unit: string }[];
  freeformNotes?: string;
  submittedAt: string;
}

export interface OrderConfirmedEmailParams {
  toEmail: string;
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: {
    itemName: string;
    requestedQty: number;
    fulfilledQty: number;
    unit: string;
    isShorted: boolean;
  }[];
}

export interface OrderSubmittedToChefParams {
  toEmail: string;
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: { itemName: string; quantity: number; unit: string }[];
  freeformNotes?: string;
}

export interface ShortageEmailParams {
  toEmail: string;
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  shortages: {
    itemName: string;
    requestedQty: number;
    fulfilledQty: number;
    unit: string;
    reason: string;
    /** What was sent in place of this item, e.g. "Miracle" or "Miracle (2 BU)". */
    replacement?: string | null;
  }[];
}

// ---- Internal helpers ----

function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendOrLog(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
  fallbackText: string;
  from?: string;
}): Promise<void> {
  const { to, subject, react, fallbackText, from } = params;

  if (!hasResend()) {
    const html = await render(react);
    console.log(
      `[EMAIL FALLBACK] From: ${from ?? FROM_EMAIL} | To: ${to} | Subject: ${subject}\n${fallbackText}\n--- HTML preview (truncated) ---\n${html.slice(0, 500)}`
    );
    return;
  }

  // Use type-specific from-address if provided, else fall back to env/default
  const fromAddress = from || process.env.RESEND_FROM_EMAIL || FROM_EMAIL;

  try {
    const { data: sendData, error } = await safeResendSend({
      from: fromAddress,
      to,
      subject,
      react,
    });
    if (error) {
      console.error("[EMAIL ERROR]", JSON.stringify(error));
    } else {
      console.log("[EMAIL] Sent successfully:", sendData?.id, "from:", fromAddress, "to:", to);
    }
  } catch (err) {
    console.error("[EMAIL ERROR] Unexpected error sending email:", err);
  }
}

// ---- Public send functions ----

/**
 * Sent to admin (Micheal) when a chef submits or updates an order.
 */
export async function sendOrderSubmittedEmail(
  params: OrderSubmittedEmailParams
): Promise<void> {
  const { restaurantName, deliveryDate } = params;
  const subject = `New order from ${restaurantName} for ${deliveryDate}`;

  const fallbackText = [
    `Restaurant: ${restaurantName}`,
    `Chef: ${params.chefName}`,
    `Delivery date: ${deliveryDate}`,
    `Submitted at: ${params.submittedAt}`,
    `Items:`,
    ...params.items.map((i) => `  ${i.itemName} — ${i.quantity} ${i.unit}`),
    params.freeformNotes ? `Notes: ${params.freeformNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendOrLog({
    to: ADMIN_EMAIL,
    subject,
    react: OrderReceived(params) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.orders,
  });
}

/**
 * Sent to the chef immediately after they submit/update their order.
 * Confirms what we received, with the line items + their freeform note.
 */
export async function sendOrderConfirmationEmail(
  params: OrderSubmittedToChefParams,
): Promise<void> {
  const { toEmail, chefName, restaurantName, deliveryDate, items, freeformNotes } = params;
  const subject = `Order Confirmed — ${deliveryDate}`;

  const fallbackText = [
    `Hi ${chefName},`,
    `Your order for ${restaurantName} on ${deliveryDate} has been received.`,
    ``,
    `Items:`,
    ...items.map((i) => `  ${i.itemName} — ${i.quantity} ${i.unit}`),
    freeformNotes ? `\nYour note: ${freeformNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: OrderConfirmation({
      chefName,
      restaurantName,
      deliveryDate,
      items,
      freeformNotes,
    }) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.orders,
  });
}

/**
 * Sent to the chef when admin marks an order as fulfilled.
 */
export async function sendOrderConfirmedEmail(
  params: OrderConfirmedEmailParams
): Promise<void> {
  const { toEmail, deliveryDate, chefName, restaurantName, items } = params;
  const subject = `Order confirmed for ${deliveryDate}`;

  const fallbackText = [
    `Chef: ${chefName} (${restaurantName})`,
    `Delivery date: ${deliveryDate}`,
    `Items:`,
    ...items.map(
      (i) =>
        `  ${i.itemName} — delivered: ${i.fulfilledQty} ${i.unit}${i.isShorted ? ` (requested: ${i.requestedQty})` : ""}`
    ),
  ].join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: OrderFulfilled({ chefName, restaurantName, deliveryDate, items }) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.orders,
  });
}

/**
 * Sent to the chef when admin marks items as shorted.
 */
export async function sendShortageEmail(params: ShortageEmailParams): Promise<void> {
  const { toEmail, deliveryDate, chefName, restaurantName, shortages } = params;
  const subject = `Update on your order for ${deliveryDate}`;

  const fallbackText = [
    `Chef: ${chefName} (${restaurantName})`,
    `Delivery date: ${deliveryDate}`,
    `Shortages:`,
    ...shortages.map(
      (s) =>
        `  ${s.itemName} — requested: ${s.requestedQty} ${s.unit}, fulfilled: ${s.fulfilledQty} ${s.unit}, reason: ${s.reason}` +
        (s.replacement ? `, replaced with: ${s.replacement}` : "")
    ),
  ].join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: ShortageNotice({ chefName, restaurantName, deliveryDate, shortages }) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.orders,
  });
}

export interface EventRequestAcceptedEmailParams {
  toEmail: string;
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: { itemName: string; quantity: number; unit: string }[];
  eventName: string | null;
  adminResponse: string | null;
}

/**
 * Sent to a chef when their advance event request is accepted and the
 * matching order line(s) are auto-created. Used for both single-item
 * accepts and batch group accepts.
 */
export async function sendEventRequestAcceptedEmail(
  params: EventRequestAcceptedEmailParams,
): Promise<void> {
  const { toEmail, chefName, restaurantName, deliveryDate, items, eventName, adminResponse } = params;
  const subject = `Event request confirmed — ${deliveryDate}`;

  const fallbackText = [
    `Hi ${chefName},`,
    `Your event request${eventName ? ` for ${eventName}` : ""} has been accepted.`,
    `Added to your ${restaurantName} order for ${deliveryDate}:`,
    ...items.map((i) => `  ${i.itemName} — ${i.quantity} ${i.unit}`),
    adminResponse ? `\nNote: ${adminResponse}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: EventRequestAccepted({
      chefName,
      restaurantName,
      deliveryDate,
      items,
      eventName,
      adminResponse,
    }) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.orders,
  });
}

export interface AvailabilityPublishedEmailParams {
  toEmail: string;
  chefName: string;
  restaurantName: string;
  /** Already-formatted human-readable delivery date (e.g. "Thursday, May 15"). */
  deliveryDate: string;
  itemCount: number;
  seasonal?: {
    endingSoon?: { name: string; season_note?: string | null }[];
    comingSoon?: { name: string; season_note?: string | null }[];
  };
}

/**
 * Sent to each chef when admin publishes availability for a delivery date.
 * Uses the AvailabilityPublished React Email template (mandala + restaurant
 * co-brand + CTA). Seasonal "Ending Soon" / "Coming Soon" callouts render
 * only when items are supplied.
 */
export async function sendAvailabilityPublishedEmail(
  params: AvailabilityPublishedEmailParams,
): Promise<void> {
  const { toEmail, chefName, restaurantName, deliveryDate, itemCount, seasonal } = params;
  const subject = `New Availability — ${deliveryDate}`;

  const fallbackLines = [
    `Hi ${chefName},`,
    `Availability has been posted for ${restaurantName} on ${deliveryDate}.`,
    `${itemCount} item${itemCount === 1 ? "" : "s"} available.`,
  ];
  if (seasonal?.endingSoon?.length) {
    fallbackLines.push("", "Ending Soon:");
    for (const it of seasonal.endingSoon) {
      fallbackLines.push(`  - ${it.name}${it.season_note ? ` (${it.season_note})` : ""}`);
    }
  }
  if (seasonal?.comingSoon?.length) {
    fallbackLines.push("", "Coming Soon:");
    for (const it of seasonal.comingSoon) {
      fallbackLines.push(`  - ${it.name}${it.season_note ? ` (${it.season_note})` : ""}`);
    }
  }
  const fallbackText = fallbackLines.join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: AvailabilityPublished({
      chefName,
      restaurantName,
      deliveryDate,
      itemCount,
      seasonal,
    }) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.availability,
  });
}

export interface AvailabilityForecastEmailParams {
  toEmail: string;
  chefName: string;
  restaurantName: string;
  /** Already-formatted reference date label, e.g. "Monday, May 26". */
  asOfDate: string;
  sections: ForecastEmailSection[];
}

/**
 * Sent to each chef with a forward-looking crop availability forecast — what's
 * harvestable now and what's coming over the next ~2 months, field + microgreen.
 * Built from getAvailabilityBuckets. Never throws into the request.
 */
export async function sendAvailabilityForecastEmail(
  params: AvailabilityForecastEmailParams,
): Promise<void> {
  const { toEmail, chefName, restaurantName, asOfDate, sections } = params;
  const subject = `What's coming from the farm — ${asOfDate}`;

  const fallbackLines = [
    `Hi ${chefName},`,
    `Here's the availability forecast for ${restaurantName} as of ${asOfDate}.`,
    ``,
  ];
  for (const sec of sections) {
    fallbackLines.push(`=== ${sec.title} (${sec.caption}) ===`);
    if (sec.entries.length === 0) {
      fallbackLines.push("  Nothing new in this window.");
    } else {
      for (const e of sec.entries) {
        const tags = [
          e.isMicrogreen ? "microgreen" : null,
          e.window ?? null,
          e.estimate ?? null,
        ].filter(Boolean);
        fallbackLines.push(`  - ${e.name}${tags.length ? ` (${tags.join(", ")})` : ""}`);
      }
    }
    fallbackLines.push("");
  }
  const fallbackText = fallbackLines.join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: AvailabilityForecast({
      chefName,
      restaurantName,
      asOfDate,
      sections,
    }) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.forecast,
  });
}

export interface PartnerReportEmailParams {
  toEmail: string;
  partnerName: string;
  period: "monthly" | "quarterly";
  /** Already-formatted period label, e.g. "April 2026" or "Q2 2026". */
  periodLabel: string;
  totalValue: string;
  deliveryCount: number;
  topItems: PartnerReportLine[];
  byRestaurant: PartnerReportLine[];
  comingSoon: ForecastEmailEntry[];
}

/**
 * Sent to a partner chef (e.g. Phil) with a monthly or quarterly summary of the
 * value of produce delivered + top crops + by-kitchen breakdown, plus a
 * forward-looking teaser. Partner-facing framing — no expense/margin jargon.
 * Never throws into the request.
 */
export async function sendPartnerReportEmail(
  params: PartnerReportEmailParams,
): Promise<void> {
  const { toEmail, partnerName, period, periodLabel, totalValue, deliveryCount, topItems, byRestaurant, comingSoon } = params;
  const periodWord = period === "quarterly" ? "Quarter" : "Month";
  const subject = `Press Farm — your ${periodWord.toLowerCase()} from the farm, ${periodLabel}`;

  const fallbackLines = [
    `Hello Chef ${partnerName},`,
    ``,
    `${periodLabel} in review.`,
    `Produce delivered: ${totalValue} across ${deliveryCount} ${deliveryCount === 1 ? "delivery" : "deliveries"}.`,
    ``,
    `By kitchen:`,
    ...byRestaurant.map((r) => `  ${r.label}: ${r.value}`),
    ``,
    `Top crops:`,
    ...topItems.map((t) => `  ${t.label}${t.sub ? ` (${t.sub})` : ""}: ${t.value}`),
    ``,
    `Coming soon from the farm:`,
    ...(comingSoon.length
      ? comingSoon.map((e) => `  - ${e.name}${e.isMicrogreen ? " (microgreen)" : ""}${e.window ? ` — ${e.window}` : ""}`)
      : ["  Fresh forecast coming soon."]),
    ``,
    `Thank you for cooking with what we grow.`,
    `— Press Farm`,
  ];
  const fallbackText = fallbackLines.join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: PartnerReport({
      partnerName,
      period,
      periodLabel,
      totalValue,
      deliveryCount,
      topItems,
      byRestaurant,
      comingSoon,
    }) as React.ReactElement,
    fallbackText,
    from: FROM_ADDRESSES.partnerReport,
  });
}
