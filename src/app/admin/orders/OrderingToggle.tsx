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
  const router = useRouter();

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/availability/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_date_id: deliveryDateId, ordering_open: !open }),
      });
      if (res.ok) {
        setOpen((prev) => !prev);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${
        open
          ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
      }`}
    >
      {loading ? "..." : open ? "Close Ordering" : "Open Ordering"}
    </button>
  );
}
