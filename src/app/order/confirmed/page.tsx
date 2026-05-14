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
    // Try to read delivery date for the confirmation flash message
    // (sessionStorage was cleared after submit, but attempt anyway)
    const raw = sessionStorage.getItem("press_farm_order_confirmed_date");
    if (raw) {
      setDeliveryDateFormatted(raw);
      sessionStorage.removeItem("press_farm_order_confirmed_date");
    }
    // Clean up any stray draft data. The draft lives in localStorage now
    // (see OrderForm.tsx); the legacy sessionStorage key is removed too
    // in case a chef has an in-flight tab from before the migration.
    localStorage.removeItem("press_farm_order");
    sessionStorage.removeItem("press_farm_order");
  }, []);

  return (
    <main className="login-bg min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Celebration flowers — small, soft, drifting in around the hero */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <img src="/assets/pressfarm/flowers/borage.png"     className="absolute top-[10%] left-[12%] w-14 sm:w-20 opacity-70 animate-[pf-float_5s_ease-in-out_infinite]" alt="" style={{ transform: "rotate(-12deg)" }} />
        <img src="/assets/pressfarm/flowers/calendula.png"  className="absolute top-[14%] right-[10%] w-16 sm:w-24 opacity-75 animate-[pf-float_6s_ease-in-out_infinite_0.6s]" alt="" style={{ transform: "rotate(15deg)" }} />
        <img src="/assets/pressfarm/flowers/pansy.png"      className="absolute bottom-[28%] left-[8%] w-14 sm:w-20 opacity-70 animate-[pf-float_7s_ease-in-out_infinite_1.2s]" alt="" style={{ transform: "rotate(8deg)" }} />
        <img src="/assets/pressfarm/flowers/chamomile.png"  className="absolute bottom-[22%] right-[12%] w-12 sm:w-16 opacity-70 animate-[pf-float_5.5s_ease-in-out_infinite_0.3s]" alt="" style={{ transform: "rotate(-18deg)" }} />
        <img src="/assets/pressfarm/flowers/bachelor-button.png" className="absolute top-[40%] right-[6%] w-10 sm:w-14 opacity-65 animate-[pf-float_6.5s_ease-in-out_infinite_1.8s]" alt="" style={{ transform: "rotate(22deg)" }} />
        <img src="/assets/pressfarm/flowers/marigold.png"   className="absolute top-[44%] left-[4%] w-10 sm:w-14 opacity-65 animate-[pf-float_6s_ease-in-out_infinite_2.2s]" alt="" style={{ transform: "rotate(-25deg)" }} />
      </div>
      <style>{`
        @keyframes pf-float {
          0%, 100% { transform: translateY(0) rotate(var(--pf-rot, 0deg)); }
          50%      { transform: translateY(-10px) rotate(var(--pf-rot, 0deg)); }
        }
      `}</style>

      <div className="text-center max-w-sm relative z-10">
        {/* Hero floral mark — Press Farm mandala as the brand celebration */}
        <div className="relative mx-auto mb-6 w-64 h-64 sm:w-80 sm:h-80 animate-[scale-in_0.4s_ease-out]">
          <img
            src="/assets/pressfarm/logo/png/pressfarm-mandala-only.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain"
          />
          {/* Green check badge in lower-right */}
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-farm-green border-4 border-farm-cream shadow-lg flex items-center justify-center">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <p className="login-eyebrow text-farm-green mb-2">Order Submitted</p>
        <h1 className="font-display text-2xl text-farm-dark mb-3">Thank you</h1>
        <p className="text-farm-muted text-sm leading-relaxed max-w-xs mx-auto">
          {deliveryDateFormatted
            ? <>Your order for <strong className="text-farm-dark">{deliveryDateFormatted}</strong> has been sent to Press Farm.</>
            : "Your order has been sent to Press Farm."}
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
