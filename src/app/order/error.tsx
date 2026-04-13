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
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <span className="text-red-500 text-xl">!</span>
        </div>
        <h2 className="text-lg font-semibold text-farm-dark">Something went wrong</h2>
        <p className="text-sm text-gray-500">
          {error.message || "We couldn't load the order form. Please try again."}
        </p>
        <button onClick={reset} className="btn-primary px-6 py-2.5 text-sm">
          Try Again
        </button>
      </div>
    </div>
  );
}
