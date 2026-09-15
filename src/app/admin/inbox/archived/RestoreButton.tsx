"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore } from "lucide-react";

/** Puts an archived reply back in the inbox (status → unread). */
export function RestoreButton({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          const res = await fetch(`/api/admin/inbox/${messageId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "mark_unread" }),
          });
          if (res.ok) router.refresh();
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-xs font-medium text-farm-green border border-farm-green/30 hover:bg-farm-green/5 disabled:opacity-50 flex-shrink-0"
      title="Move back to the inbox"
    >
      <ArchiveRestore className="w-4 h-4" strokeWidth={1.75} />
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
