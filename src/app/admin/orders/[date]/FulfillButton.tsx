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
  const router = useRouter();

  async function handleFulfill() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "fulfilled" }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleFulfill}
      disabled={loading}
      className="min-h-[44px] px-4 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-800 active:bg-green-900 disabled:opacity-60 transition-colors"
    >
      {loading ? "Saving..." : "Mark as Fulfilled"}
    </button>
  );
}
