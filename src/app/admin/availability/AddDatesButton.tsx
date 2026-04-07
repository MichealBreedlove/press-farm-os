"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddDatesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setResult(null);
    setError(null);

    const res = await fetch("/api/delivery-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 4 }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add dates");
      return;
    }

    setResult(`Added ${data.count} date${data.count === 1 ? "" : "s"}`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 px-4 py-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Add Delivery Dates</h2>
      <p className="text-xs text-gray-500 mb-3">
        Adds the next 4 dates following the Thu / Sat / Mon schedule.
      </p>
      {result && (
        <p className="text-xs text-green-700 font-medium mb-2">{result}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <button
        onClick={handleAdd}
        disabled={isPending}
        className="w-full py-3 rounded-lg bg-farm-green text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:bg-green-800 transition-colors"
      >
        {isPending ? "Adding…" : "Add Next 4 Dates"}
      </button>
    </div>
  );
}
