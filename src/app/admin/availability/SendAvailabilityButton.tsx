"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function SendAvailabilityButton({ date, itemCount }: { date: string; itemCount: number }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/availability/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_date: date }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to send");
      }
    } catch {
      setError("Network error");
    }
    setSending(false);
  }

  if (sent) {
    return (
      <span className="text-xs text-white/70 flex items-center gap-1">
        <Send className="w-3.5 h-3.5" /> Sent to chefs
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={sending || itemCount === 0}
        className="flex items-center gap-1.5 bg-white text-farm-green text-xs font-medium rounded-lg px-3 py-1.5 min-h-0 hover:bg-green-50 transition-colors disabled:opacity-50"
      >
        <Send className="w-3.5 h-3.5" />
        {sending ? "Sending..." : "Email Chefs"}
      </button>
      {error && <p className="text-xs text-red-300 mt-1">{error}</p>}
    </div>
  );
}
