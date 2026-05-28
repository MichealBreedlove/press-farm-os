"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LostReasonModal } from "./LostReasonModal";
import type { MicrogreenTrayStatus } from "@/types/database";

type Props = {
  trayId: string;
  trayLabel: string;
  status: MicrogreenTrayStatus;
  hasHarvests: boolean;
};

const ACTIVE: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

export function TrayActionsFooter({ trayId, trayLabel, status, hasHarvests }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canMarkLost = ACTIVE.includes(status);
  const canDelete = !hasHarvests;

  if (!canMarkLost && !canDelete) return null;

  async function markLost(reason: string) {
    const res = await fetch(`/api/microgreens/trays/${trayId}/terminate`, {
      method: "POST",
      body: JSON.stringify({ lost: true, lost_reason: reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not mark as lost.");
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete tray ${trayLabel}? This is permanent.`)) return;
    setDeleteError(null);
    const res = await fetch(`/api/microgreens/trays/${trayId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/microgreens/trays");
      return;
    }
    const body = await res.json().catch(() => ({}));
    setDeleteError(body.error ?? "Could not delete tray.");
  }

  return (
    <>
      <div className="border-t border-farm-dark/10 pt-4 mt-6 flex flex-wrap gap-2">
        {canMarkLost && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 text-sm rounded-lg border border-red-700 text-red-700 font-medium hover:bg-red-50"
          >
            Mark as lost…
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 text-sm rounded-lg bg-red-700 text-white font-medium hover:bg-red-800"
          >
            Delete tray
          </button>
        )}
      </div>
      {deleteError && (
        <p className="text-sm text-red-700 mt-2">{deleteError}</p>
      )}
      <LostReasonModal
        open={modalOpen}
        trayCount={1}
        onClose={() => setModalOpen(false)}
        onConfirm={markLost}
      />
    </>
  );
}
