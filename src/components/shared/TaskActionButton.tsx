"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";

/**
 * "Finished" / "Undo" button for a task on the read-only board, for the
 * roles allowed to finish tasks there (Head Farm Hand).
 */
export function TaskActionButton({ taskId, action }: { taskId: string; action: "complete" | "reopen" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/tasks/${taskId}/${action}`, { method: "POST" });
      // 409 = someone else already did it; just resync.
      if (!res.ok && res.status !== 409) setFailed(true);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {action === "complete" ? (
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-farm-green text-white text-base font-semibold hover:bg-farm-green/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" aria-hidden="true" /> {busy ? "Saving…" : "Finished"}
        </button>
      ) : (
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="min-h-[44px] px-3 rounded-lg text-sm font-medium text-farm-dark border border-farm-dark/15 bg-white hover:bg-farm-cream/60 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" /> {busy ? "Saving…" : "Undo"}
        </button>
      )}
      {failed && <p role="alert" className="text-xs text-red-700 mt-1.5">Couldn&apos;t save — try again.</p>}
    </div>
  );
}
