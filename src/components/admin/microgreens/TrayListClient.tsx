"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StageBadge } from "./StageBadge";
import { LostReasonModal } from "./LostReasonModal";
import type { MicrogreenTrayStatus } from "@/types/database";

const ACTIVE: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

export type TrayRow = {
  id: string;
  tray_label: string;
  status: MicrogreenTrayStatus;
  sow_date: string;
  cropName: string;
  daysIn: number;
  nextTransition: string | null;
};

export function TrayListClient({ trays }: { trays: TrayRow[] }) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function bulkLost(reason: string) {
    const res = await fetch("/api/microgreens/trays/bulk-lost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tray_ids: [...selected], lost_reason: reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not mark trays as lost.");
    }
    cancelSelect();
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        {selectMode ? (
          <button
            type="button"
            onClick={cancelSelect}
            className="text-sm px-3 py-1.5 rounded-lg border border-farm-dark/15 text-farm-muted"
          >
            Cancel select
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-farm-dark/15 text-farm-dark"
          >
            Select
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {trays.map((t) => {
          const isActive = ACTIVE.includes(t.status);
          const checked = selected.has(t.id);

          if (selectMode) {
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={!isActive}
                  onClick={() => isActive && toggle(t.id)}
                  className={
                    "w-full bg-white border rounded-xl px-4 py-3 flex items-center gap-3 text-left " +
                    (isActive
                      ? "border-farm-dark/10 hover:border-farm-dark/25"
                      : "border-farm-dark/5 opacity-50 cursor-not-allowed")
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => isActive && toggle(t.id)}
                    disabled={!isActive}
                    className="w-5 h-5 accent-farm-green"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-farm-muted">{t.tray_label}</span>
                      <span className="text-sm font-medium text-farm-dark truncate">{t.cropName}</span>
                    </div>
                    <p className="text-[11px] text-farm-muted mt-0.5">
                      Sown {t.sow_date} · day {t.daysIn}{t.nextTransition ? ` · ${t.nextTransition}` : ""}
                    </p>
                  </div>
                  <StageBadge status={t.status} />
                </button>
              </li>
            );
          }

          return (
            <li key={t.id}>
              <Link
                href={`/admin/microgreens/trays/${t.id}`}
                className="bg-white border border-farm-dark/10 rounded-xl px-4 py-3 hover:border-farm-dark/25 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-farm-muted">{t.tray_label}</span>
                    <span className="text-sm font-medium text-farm-dark truncate">{t.cropName}</span>
                  </div>
                  <p className="text-[11px] text-farm-muted mt-0.5">
                    Sown {t.sow_date} · day {t.daysIn}{t.nextTransition ? ` · ${t.nextTransition}` : ""}
                  </p>
                </div>
                <StageBadge status={t.status} />
              </Link>
            </li>
          );
        })}
      </ul>

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3">
          <div className="max-w-4xl mx-auto bg-white border border-farm-dark/15 rounded-xl shadow-lg p-3 flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelSelect}
                className="px-3 py-1.5 text-sm text-farm-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-700 text-white font-medium"
              >
                Mark as lost…
              </button>
            </div>
          </div>
        </div>
      )}

      <LostReasonModal
        open={modalOpen}
        trayCount={selected.size}
        onClose={() => setModalOpen(false)}
        onConfirm={bulkLost}
      />
    </>
  );
}
