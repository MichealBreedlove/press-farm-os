"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function SendDigestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports/weekly-digest", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult("Digest sent!");
      } else {
        setResult(data.error ? "Email failed — check Resend config" : "Sent (check email)");
      }
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className="card-interactive p-4 flex items-center gap-3 w-full text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-farm-green text-white flex items-center justify-center flex-shrink-0">
        <Mail className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-farm-dark">
          {loading ? "Sending..." : result ?? "Send Weekly Digest"}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Email summary of last 7 days</p>
      </div>
    </button>
  );
}
