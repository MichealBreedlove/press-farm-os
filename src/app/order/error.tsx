"use client";

import { useEffect } from "react";

export default function OrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Order Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-farm-cream flex items-center justify-center px-6">
      <div className="text-center space-y-5 max-w-sm">
        <div className="relative mx-auto w-32 h-32">
          <img
            src="/assets/pressfarm/flowers/hairy-vetch.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain opacity-90"
          />
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-red-500 border-4 border-farm-cream shadow-lg flex items-center justify-center">
            <span className="text-white text-base font-bold">!</span>
          </div>
        </div>
        <p className="login-eyebrow text-red-500">Something went wrong</p>
        <h2 className="font-display text-2xl text-farm-dark">Couldn&apos;t load the order form</h2>
        <p className="text-sm text-farm-muted leading-relaxed">
          {error.message || "We couldn't load the order form. Please try again."}
        </p>
        <button onClick={reset} className="btn-primary px-6 py-2.5 text-sm">
          Try Again
        </button>
      </div>
    </div>
  );
}
