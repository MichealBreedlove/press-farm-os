"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MailOpen, Archive, RotateCw } from "lucide-react";

interface Props {
  messageId: string;
  status: "unread" | "read" | "archived";
  extractionStatus: "pending" | "done" | "failed" | "skipped";
}

export function InboxActions({ messageId, status, extractionStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "mark_unread" | "mark_read" | "archive" | "reextract") {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/inbox/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Action failed: ${j?.error ?? res.status}`);
        return;
      }
      if (action === "archive") {
        router.push("/admin/inbox");
        router.refresh();
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || isPending;

  return (
    <div className="flex items-center gap-1.5">
      {status === "unread" ? (
        <button
          onClick={() => act("mark_read")}
          disabled={disabled}
          className="p-2 rounded-md text-farm-muted hover:text-farm-green hover:bg-farm-cream/60 transition-colors min-h-0 min-w-0"
          title="Mark as read"
        >
          <MailOpen className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => act("mark_unread")}
          disabled={disabled}
          className="p-2 rounded-md text-farm-muted hover:text-farm-green hover:bg-farm-cream/60 transition-colors min-h-0 min-w-0"
          title="Mark as unread"
        >
          <Mail className="w-4 h-4" />
        </button>
      )}

      {extractionStatus === "failed" && (
        <button
          onClick={() => act("reextract")}
          disabled={disabled}
          className="p-2 rounded-md text-amber-700 hover:text-amber-800 hover:bg-amber-50 transition-colors min-h-0 min-w-0"
          title="Re-run extraction"
        >
          <RotateCw className={`w-4 h-4 ${busy === "reextract" ? "animate-spin" : ""}`} />
        </button>
      )}

      <button
        onClick={() => act("archive")}
        disabled={disabled}
        className="p-2 rounded-md text-farm-muted hover:text-farm-dark hover:bg-farm-cream/60 transition-colors min-h-0 min-w-0"
        title="Archive"
      >
        <Archive className="w-4 h-4" />
      </button>
    </div>
  );
}
