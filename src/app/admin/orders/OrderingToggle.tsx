"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OrderingToggleProps {
  deliveryDateId: string;
  orderingOpen: boolean;
}

/**
 * OrderingToggle — toggle button to open/close ordering for a delivery date.
 * Calls Supabase via PATCH to the availability API (handled as a server action proxy).
 */
export function OrderingToggle({ deliveryDateId, orderingOpen }: OrderingToggleProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(orderingOpen);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/availability/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_date_id: deliveryDateId, ordering_open: !open }),
      });
      if (res.ok) {
        setOpen((prev) => !prev);
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
        onClick={handleToggle}
        disabled={loading}
        className={`min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${
          open
            ? "bg-white/20 text-white border border-white/30 hover:bg-white/30"
            : "bg-white text-farm-green border border-white hover:opacity-90"
        }`}
      >
        {loading ? "..." : open ? "Close Ordering" : "Open Ordering"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
