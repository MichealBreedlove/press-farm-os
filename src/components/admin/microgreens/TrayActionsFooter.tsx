"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LostReasonModal } from "./LostReasonModal";
import { TerminateDistributeModal } from "./TerminateDistributeModal";
import type { MicrogreenTrayStatus } from "@/types/database";

type Props = {
  trayId: string;
  trayLabel: string;
  status: MicrogreenTrayStatus;
  hasHarvests: boolean;
  cropName: string;
  isContinuous: boolean;
  hasItemLink: boolean;
  valuePerTray: number | null;
  producingMonth: string; // YYYY-MM the tray was producing (harvesting_start ?? sow_date)
  distributedCount: number; // delivery_items rows carrying this tray's value
};

const ACTIVE: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

export function TrayActionsFooter({
  trayId, trayLabel, status, hasHarvests,
  cropName, isContinuous, hasItemLink, valuePerTray, producingMonth, distributedCount,
}: Props) {
  const router = useRouter();
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [terminateModalOpen, setTerminateModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Continuous crops get the distribute dialog once they're producing — and
  // again after termination if their value never got distributed (e.g. a tray
  // terminated through the plain path).
  const canDistribute =
    isContinuous &&
    distributedCount === 0 &&
    (status === "harvesting" || status === "terminated");
  const canMarkLost = ACTIVE.includes(status);
  const canUndo = distributedCount > 0;
  const canDelete = !hasHarvests && distributedCount === 0;

  if (!canMarkLost && !canDelete && !canDistribute && !canUndo) return null;

  async function markLost(reason: string) {
    const res = await fetch(`/api/microgreens/trays/${trayId}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lost: true, lost_reason: reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not mark as lost.");
    }
    router.refresh();
  }

  async function handleUndo() {
    if (
      !window.confirm(
        `Remove the ${distributedCount} distributed income lines for ${trayLabel}? Delivery totals recalculate automatically; the tray stays terminated and can be re-distributed.`,
      )
    )
      return;
    setActionError(null);
    const res = await fetch(`/api/microgreens/trays/${trayId}/terminate`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Could not undo the distribution.");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete tray ${trayLabel}? This is permanent.`)) return;
    setActionError(null);
    const res = await fetch(`/api/microgreens/trays/${trayId}`, { method: "DELETE" });
    if (res.ok) {
      router.replace("/admin/microgreens/trays");
      return;
    }
    const body = await res.json().catch(() => ({}));
    setActionError(body.error ?? "Could not delete tray.");
  }

  return (
    <>
      <div className="border-t border-farm-dark/10 pt-4 mt-6 flex flex-wrap gap-2">
        {canDistribute && (
          <button
            type="button"
            onClick={() => setTerminateModalOpen(true)}
            className="px-4 py-2 text-sm rounded-lg bg-farm-green text-white font-medium hover:opacity-90"
          >
            {status === "terminated" ? "Distribute tray value…" : "Terminate & distribute…"}
          </button>
        )}
        {canUndo && (
          <button
            type="button"
            onClick={handleUndo}
            className="px-4 py-2 text-sm rounded-lg border border-farm-dark/20 text-farm-dark font-medium hover:border-farm-dark/40"
          >
            Undo income distribution
          </button>
        )}
        {canMarkLost && (
          <button
            type="button"
            onClick={() => setLostModalOpen(true)}
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
      {actionError && (
        <p className="text-sm text-red-700 mt-2">{actionError}</p>
      )}
      <LostReasonModal
        open={lostModalOpen}
        trayCount={1}
        onClose={() => setLostModalOpen(false)}
        onConfirm={markLost}
      />
      <TerminateDistributeModal
        open={terminateModalOpen}
        trayId={trayId}
        trayLabel={trayLabel}
        cropName={cropName}
        hasItemLink={hasItemLink}
        defaultMonth={producingMonth}
        defaultValue={valuePerTray}
        onClose={() => setTerminateModalOpen(false)}
        onDone={() => router.refresh()}
      />
    </>
  );
}
