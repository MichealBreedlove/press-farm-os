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
    <main className="min-h-screen bg-farm-cream flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Success icon */}
        <div className="w-16 h-16 bg-farm-green rounded-full flex items-center justify-center mx-auto mb-5 shadow-md animate-[scale-in_0.3s_ease-out]">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-display text-2xl text-farm-dark mb-2">Order Submitted</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          {deliveryDateFormatted
            ? `Your order for ${deliveryDateFormatted} has been sent to Micheal.`
            : "Your order has been sent to Micheal."}
        </p>
        <p className="text-gray-400 text-xs mt-2">
          You&apos;ll receive a confirmation email shortly.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/order"
            className="block w-full bg-farm-green text-white font-semibold py-3 rounded-xl min-h-[44px] flex items-center justify-center"
          >
            Back to Order
          </Link>
          <Link
            href="/history"
            className="block w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl min-h-[44px] flex items-center justify-center"
          >
            View Order History
          </Link>
        </div>
      </div>
    </main>
  );
}
