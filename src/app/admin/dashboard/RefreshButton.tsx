"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 1500);
    });
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs text-farm-muted hover:text-farm-green min-h-[36px] px-3 py-1.5 rounded-lg hover:bg-farm-cream/60 transition-colors disabled:opacity-50"
      aria-label="Refresh stats"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
      {justRefreshed ? "Refreshed" : "Refresh"}
    </button>
  );
}
