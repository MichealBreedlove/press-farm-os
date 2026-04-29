"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin Error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center space-y-5 max-w-sm">
        <div className="relative mx-auto w-28 h-28">
          <img
            src="/assets/pressfarm/flowers/thyme.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain opacity-90"
          />
          <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-red-500 border-4 border-farm-cream shadow-lg flex items-center justify-center">
            <span className="text-white text-base font-bold">!</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-farm-dark">Something went wrong</h2>
        <p className="text-sm text-gray-500">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="btn-primary px-6 py-2.5 text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
