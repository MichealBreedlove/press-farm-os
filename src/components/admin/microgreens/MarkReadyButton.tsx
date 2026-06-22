"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Grower action on the tray detail page: confirm a tray has reached baby green
 * and is ready to cut. Advances the tray to 'harvesting' status, which is what
 * surfaces the crop on the chef/bar "Ready in the Greenhouse" order banner.
 * Only rendered when the tray's next stage is actually 'harvesting'.
 */
export function MarkReadyButton({ trayId }: { trayId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markReady() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/microgreens/trays/${trayId}/advance`, { method: "POST" });
    if (res.ok) {
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "Could not mark this tray ready.");
    setBusy(false);
  }

  return (
    <div className="border border-farm-green/25 bg-farm-green/5 rounded-xl p-4">
      <button
        type="button"
        onClick={markReady}
        disabled={busy}
        className="btn-primary disabled:opacity-60"
      >
        {busy ? "Marking…" : "Mark ready to harvest"}
      </button>
      <p className="text-[11px] text-farm-muted mt-2 leading-snug">
        Confirms this tray is at baby green and shows the crop to chefs &amp; the bar
        team as ready to cut in the greenhouse.
      </p>
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
