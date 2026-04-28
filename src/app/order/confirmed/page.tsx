"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * /order/confirmed — Post-submit success screen
 *
 * Reads delivery date from sessionStorage (if available) for the message.
 * Cleans up any lingering order data.
 */
export default function OrderConfirmedPage() {
  const [deliveryDateFormatted, setDeliveryDateFormatted] = useState<string>("");

  useEffect(() => {
    // Try to read delivery date for the confirmation message
    // (sessionStorage was cleared after submit, but attempt anyway)
    const raw = sessionStorage.getItem("press_farm_order_confirmed_date");
    if (raw) {
      setDeliveryDateFormatted(raw);
      sessionStorage.removeItem("press_farm_order_confirmed_date");
    }
    // Clean up any stray session data
    sessionStorage.removeItem("press_farm_order");
  }, []);

  return (
    <main className="login-bg min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center max-w-sm">
        {/* Hero floral mark — replaces generic checkmark with brand illustration */}
        <div className="relative mx-auto mb-6 w-32 h-32 sm:w-40 sm:h-40 animate-[scale-in_0.4s_ease-out]">
          <img
            src="/assets/flowers/squash-blossom.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain"
          />
          {/* Small green check badge in lower-right */}
          <div className="absolute -bottom-1 -right-1 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-farm-green border-4 border-farm-cream shadow-md flex items-center justify-center">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <p className="login-eyebrow text-farm-green mb-2">Order Submitted</p>
        <h1 className="font-display text-2xl text-farm-dark mb-3">Thank you</h1>
        <p className="text-farm-muted text-sm leading-relaxed max-w-xs mx-auto">
          {deliveryDateFormatted
            ? <>Your order for <strong className="text-farm-dark">{deliveryDateFormatted}</strong> has been sent to Micheal.</>
            : "Your order has been sent to Micheal."}
        </p>
        <p className="text-farm-muted/70 text-xs mt-3">
          A confirmation email is on its way.
        </p>

        <div className="mt-10 flex flex-col gap-3 max-w-xs mx-auto">
          <Link href="/order" className="login-cta inline-flex items-center justify-center">
            Place Another Order
          </Link>
          <Link
            href="/history"
            className="login-link"
          >
            View Order History
          </Link>
        </div>
      </div>
    </main>
  );
}
