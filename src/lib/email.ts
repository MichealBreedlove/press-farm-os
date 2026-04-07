/**
 * Press Farm OS — Email helper
 *
 * Wraps Resend with a graceful console.log fallback when RESEND_API_KEY is not set.
 * Email errors never fail the API response — they are caught and logged.
 */

import { render } from "@react-email/render";
import { getResendClient } from "@/lib/resend/client";
import { ADMIN_EMAIL, FROM_EMAIL } from "@/lib/constants";
import OrderReceived from "@/emails/order-received";
import OrderFulfilled from "@/emails/order-fulfilled";
import ShortageNotice from "@/emails/shortage-notice";

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
}): Promise<void> {
  const { to, subject, react, fallbackText } = params;

  if (!hasResend()) {
    const html = await render(react);
    console.log(
      `[EMAIL FALLBACK] To: ${to} | Subject: ${subject}\n${fallbackText}\n--- HTML preview (truncated) ---\n${html.slice(0, 500)}`
    );
    return;
  }

  try {
    const { error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react,
    });
    if (error) {
      console.error("[EMAIL ERROR]", error);
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
        `  ${s.itemName} — requested: ${s.requestedQty} ${s.unit}, fulfilled: ${s.fulfilledQty} ${s.unit}, reason: ${s.reason}`
    ),
  ].join("\n");

  await sendOrLog({
    to: toEmail,
    subject,
    react: ShortageNotice({ chefName, restaurantName, deliveryDate, shortages }) as React.ReactElement,
    fallbackText,
  });
}
