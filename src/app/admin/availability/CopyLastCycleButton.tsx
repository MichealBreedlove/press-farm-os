"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus } from "lucide-react";

interface Props {
  targetDate: string;
  restaurants: { id: string; name: string }[];
}

/**
 * List-level "Copy last cycle" — runs the existing duplicate endpoint for
 * every restaurant so a fresh date gets last cycle's availability without
 * opening the editor first. Same call the editor's own button makes.
 */
export function CopyLastCycleButton({ targetDate, restaurants }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function copy() {
    setError(null);
    start(async () => {
      try {
        const results = await Promise.all(
          restaurants.map((r) =>
            fetch("/api/availability/duplicate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurant_id: r.id, target_date: targetDate }),
            }),
          ),
        );
        if (results.some((res) => !res.ok)) throw new Error("One or more restaurants failed to copy.");
        setDone(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Copy failed.");
      }
    });
  }

  if (done) {
    return <p className="text-xs text-farm-green px-1">Copied last cycle. Open the date to review.</p>;
  }
  return (
    <div className="px-1">
      <button
        type="button"
        onClick={copy}
        disabled={pending || restaurants.length === 0}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-farm-green hover:underline min-h-[40px] disabled:opacity-50"
      >
        <CopyPlus className="w-3.5 h-3.5" strokeWidth={2} />
        {pending ? "Copying…" : "Copy last cycle's availability"}
      </button>
      {error && <p className="text-xs text-red-700 mt-0.5">{error}</p>}
    </div>
  );
}
