"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDeliveryDate } from "@/lib/utils";

interface Row {
  id: string;
  restaurant_name: string;
  chef_name: string;
  item_name: string;
  quantity: number;
  unit: string;
  needed_by_date: string;
  event_name: string | null;
  notes: string | null;
  status: "pending" | "accepted" | "declined" | "fulfilled";
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
}

interface Props {
  pending: Row[];
  responded: Row[];
}

export function EventRequestsClient({ pending, responded }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "decline") {
    setBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/event-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, admin_response: responseText.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSuccess(action === "accept" ? "Accepted — order line added + chef emailed." : "Declined.");
      setActiveId(null);
      setResponseText("");
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-farm-green-light border border-farm-green/20 rounded-xl px-4 py-3 text-sm text-farm-green">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <p className="section-eyebrow with-flower text-farm-muted mb-2">
          Pending ({pending.length})
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-farm-muted text-center py-6">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-farm-dark">
                      {r.quantity} {r.unit?.toUpperCase()} {r.item_name}
                    </p>
                    <p className="text-xs text-farm-muted mt-0.5">
                      {formatDeliveryDate(r.needed_by_date)}
                      {r.event_name ? ` · ${r.event_name}` : ""}
                    </p>
                    <p className="text-xs text-farm-muted mt-1">
                      {r.restaurant_name} · {r.chef_name}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-farm-dark/80 italic mt-2 pl-3 border-l-2 border-pf-master-gold/40">
                        {r.notes}
                      </p>
                    )}
                  </div>
                  <span className="badge-gold flex-shrink-0">pending</span>
                </div>

                {activeId === r.id ? (
                  <div className="mt-3 pt-3 border-t border-farm-dark/5 space-y-2">
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Optional note back to chef"
                      className="input-field min-h-[60px] text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => act(r.id, "accept")}
                        disabled={busyId === r.id}
                        className="btn-primary text-xs min-h-[44px] disabled:opacity-50"
                      >
                        {busyId === r.id ? "…" : "Accept"}
                      </button>
                      <button
                        onClick={() => act(r.id, "decline")}
                        disabled={busyId === r.id}
                        className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-medium disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => { setActiveId(null); setResponseText(""); }}
                        className="min-h-[44px] rounded-xl border border-farm-dark/10 bg-white text-farm-muted text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveId(r.id); setResponseText(""); }}
                    className="mt-3 text-xs font-medium text-farm-green hover:underline"
                  >
                    Respond →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {responded.length > 0 && (
        <div>
          <p className="section-eyebrow with-flower text-farm-muted mb-2">
            Responded ({responded.length})
          </p>
          <div className="space-y-2">
            {responded.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-farm-dark/5 p-4 opacity-90">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-farm-dark">
                      {r.quantity} {r.unit?.toUpperCase()} {r.item_name}
                    </p>
                    <p className="text-xs text-farm-muted mt-0.5">
                      {formatDeliveryDate(r.needed_by_date)}
                      {r.event_name ? ` · ${r.event_name}` : ""}
                    </p>
                    <p className="text-xs text-farm-muted mt-1">
                      {r.restaurant_name} · {r.chef_name}
                    </p>
                    {r.admin_response && (
                      <p className="text-xs text-farm-dark/80 italic mt-2 pl-3 border-l-2 border-farm-green/50">
                        {r.admin_response}
                      </p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 ${
                      r.status === "accepted" || r.status === "fulfilled"
                        ? "badge-green"
                        : "badge-red"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
