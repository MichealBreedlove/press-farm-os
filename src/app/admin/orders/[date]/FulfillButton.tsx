"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/types";

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

const NEXT_STATUS: Partial<Record<OrderStatus, { target: OrderStatus; label: string; color: string }>> = {
  submitted: { target: "in_progress", label: "Start Picking", color: "bg-amber-500 hover:bg-amber-600" },
  in_progress: { target: "fulfilled", label: "Mark Fulfilled", color: "bg-farm-green hover:bg-farm-green/90" },
};

/**
 * Status progression button: submitted → in_progress → fulfilled
 */
export function FulfillButton({ orderId, currentStatus }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const next = NEXT_STATUS[currentStatus];
  if (!next) return null;

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next!.target }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError("Failed to update. Please refresh.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${next.color} text-white min-h-[44px] px-4 rounded-xl text-sm font-medium disabled:opacity-60 transition-colors`}
      >
        {loading ? "Saving..." : next.label}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
