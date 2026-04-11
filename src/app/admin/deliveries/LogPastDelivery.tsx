"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

export function LogPastDelivery() {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [date, setDate] = useState("");

  function handleGo() {
    if (date) router.push(`/admin/deliveries/${date}`);
  }

  return (
    <div>
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-farm-green hover:text-farm-green transition-colors flex items-center justify-center gap-2 min-h-0"
        >
          <CalendarPlus className="w-4 h-4" />
          Log Past Delivery
        </button>
      ) : (
        <div className="card p-4 space-y-3">
          <h3 className="font-display text-sm text-farm-dark">Log Delivery for Any Date</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleGo} disabled={!date} className="btn-primary flex-1">
              Go to Date
            </button>
            <button onClick={() => setShowPicker(false)} className="btn-ghost flex-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
