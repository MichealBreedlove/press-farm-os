"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FulfillButtonProps {
  orderId: string;
}

/**
 * FulfillButton — marks an order as fulfilled via PATCH /api/orders/[orderId]
 */
export function FulfillButton({ orderId }: FulfillButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleFulfill() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "fulfilled" }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError("Failed to update. Please refresh and try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleFulfill}
        disabled={loading}
        className="min-h-[44px] px-4 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-800 active:bg-green-900 disabled:opacity-60 transition-colors"
      >
        {loading ? "Saving..." : "Mark as Fulfilled"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
