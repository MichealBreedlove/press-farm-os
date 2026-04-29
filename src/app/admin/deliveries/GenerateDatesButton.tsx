"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

export function GenerateDatesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/delivery-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 6 }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Added ${data.count} delivery dates`);
        router.refresh();
      } else {
        setResult(data.error ?? "Failed to generate dates");
      }
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full card-interactive px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-farm-green-light flex items-center justify-center">
            <CalendarPlus className="w-4 h-4 text-farm-green" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-farm-dark">
              {loading ? "Generating..." : "Generate Upcoming Dates"}
            </p>
            <p className="text-xs text-farm-muted">Add next 6 delivery dates (Thu/Sat/Mon)</p>
          </div>
        </div>
      </button>
      {result && (
        <p className={`text-xs mt-1 px-2 ${result.includes("Added") ? "text-farm-green" : "text-red-500"}`}>
          {result}
        </p>
      )}
    </div>
  );
}
