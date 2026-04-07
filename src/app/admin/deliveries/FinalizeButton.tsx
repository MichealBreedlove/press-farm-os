"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FinalizeButton({ month }: { month: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleFinalize() {
    const label = new Date(month + "-01T00:00:00").toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    if (!confirm(`Finalize all deliveries for ${label}? This cannot be undone.`)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deliveries/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to finalize");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="text-xs text-red-300 mb-1">{error}</p>}
      <button
        onClick={handleFinalize}
        disabled={loading}
        className="text-xs bg-white text-green-800 px-3 py-1.5 rounded-full font-semibold disabled:opacity-50"
      >
        {loading ? "..." : "Finalize Month"}
      </button>
    </div>
  );
}
