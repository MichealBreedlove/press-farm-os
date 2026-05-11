"use client";

import { useMemo, useState, useTransition } from "react";
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
  event_group_id: string | null;
  created_at: string;
}

interface Props {
  pending: Row[];
  responded: Row[];
}

interface Group {
  // Stable key for React: real group id when present, else a synthetic
  // solo key derived from the row id so legacy single-item rows still
  // render uniquely.
  key: string;
  group_id: string | null;
  restaurant_name: string;
  chef_name: string;
  needed_by_date: string;
  event_name: string | null;
  notes: string | null;
  created_at: string;
  lines: Row[];
}

function groupRows(rows: Row[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = r.event_group_id ?? `solo:${r.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.lines.push(r);
      continue;
    }
    map.set(key, {
      key,
      group_id: r.event_group_id,
      restaurant_name: r.restaurant_name,
      chef_name: r.chef_name,
      needed_by_date: r.needed_by_date,
      event_name: r.event_name,
      notes: r.notes,
      created_at: r.created_at,
      lines: [r],
    });
  }
  // Preserve the SQL ordering (date asc, created_at desc) by sorting
  // groups on the same keys.
  return Array.from(map.values()).sort((a, b) => {
    if (a.needed_by_date !== b.needed_by_date)
      return a.needed_by_date < b.needed_by_date ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

export function EventRequestsClient({ pending, responded }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Which group's response form is open. Only one group can be in
  // respond mode at a time so the admin can't accidentally apply the
  // same note to two events.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pendingGroups = useMemo(() => groupRows(pending), [pending]);
  const respondedGroups = useMemo(() => groupRows(responded), [responded]);

  /**
   * Send accept/decline. If the group has a real event_group_id we call
   * the batch endpoint so a single combined email goes to the chef;
   * otherwise (legacy solo row) we fall back to the per-id endpoint.
   */
  async function act(group: Group, action: "accept" | "decline") {
    setBusyKey(group.key);
    setError(null);
    setSuccess(null);
    try {
      const note = responseText.trim() || null;
      let res: Response;
      if (group.group_id) {
        res = await fetch(`/api/event-requests/group/${group.group_id}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, admin_response: note }),
        });
      } else {
        // Single legacy row — use the per-id endpoint.
        res = await fetch(`/api/event-requests/${group.lines[0].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, admin_response: note }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");

      if (action === "accept") {
        const acceptedCount = typeof json.accepted_count === "number"
          ? json.accepted_count
          : group.lines.filter((l) => l.status === "pending").length;
        const failedCount = typeof json.failed_count === "number" ? json.failed_count : 0;
        setSuccess(
          failedCount > 0
            ? `Accepted ${acceptedCount} · ${failedCount} failed — order lines added and chef emailed.`
            : `Accepted ${acceptedCount} ${acceptedCount === 1 ? "line" : "lines"} — order added and chef emailed.`,
        );
      } else {
        const declinedCount = typeof json.declined === "number"
          ? json.declined
          : group.lines.filter((l) => l.status === "pending").length;
        setSuccess(`Declined ${declinedCount} ${declinedCount === 1 ? "line" : "lines"}.`);
      }
      setActiveKey(null);
      setResponseText("");
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyKey(null);
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
          Pending ({pendingGroups.length})
        </p>
        {pendingGroups.length === 0 ? (
          <p className="text-sm text-farm-muted text-center py-6">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingGroups.map((g) => {
              const pendingLineCount = g.lines.filter((l) => l.status === "pending").length;
              return (
                <div key={g.key} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-farm-dark">
                        {formatDeliveryDate(g.needed_by_date)}
                        {g.event_name && (
                          <span className="text-farm-muted font-normal"> · {g.event_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-farm-muted mt-0.5">
                        {g.restaurant_name} · {g.chef_name}
                      </p>
                    </div>
                    <span className="badge-gold flex-shrink-0">
                      {pendingLineCount} {pendingLineCount === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {g.lines.map((l) => (
                      <li key={l.id} className="text-sm text-farm-dark/90">
                        <span className="font-medium">{l.quantity}</span>{" "}
                        <span className="text-farm-muted">{l.unit?.toUpperCase()}</span>{" "}
                        {l.item_name}
                      </li>
                    ))}
                  </ul>

                  {g.notes && (
                    <p className="text-xs text-farm-dark/80 italic mt-3 pl-3 border-l-2 border-pf-master-gold/40">
                      {g.notes}
                    </p>
                  )}

                  {activeKey === g.key ? (
                    <div className="mt-3 pt-3 border-t border-farm-dark/5 space-y-2">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Optional note back to chef (applies to every item below)"
                        className="input-field min-h-[60px] text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => act(g, "accept")}
                          disabled={busyKey === g.key}
                          className="btn-primary text-xs min-h-[44px] disabled:opacity-50"
                        >
                          {busyKey === g.key
                            ? "…"
                            : pendingLineCount > 1
                              ? `Accept ${pendingLineCount}`
                              : "Accept"}
                        </button>
                        <button
                          onClick={() => act(g, "decline")}
                          disabled={busyKey === g.key}
                          className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-medium disabled:opacity-50"
                        >
                          {pendingLineCount > 1 ? `Decline ${pendingLineCount}` : "Decline"}
                        </button>
                        <button
                          onClick={() => { setActiveKey(null); setResponseText(""); }}
                          className="min-h-[44px] rounded-xl border border-farm-dark/10 bg-white text-farm-muted text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setActiveKey(g.key); setResponseText(""); }}
                      className="mt-3 text-xs font-medium text-farm-green hover:underline"
                    >
                      Respond →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {respondedGroups.length > 0 && (
        <div>
          <p className="section-eyebrow with-flower text-farm-muted mb-2">
            Responded ({respondedGroups.length})
          </p>
          <div className="space-y-2">
            {respondedGroups.map((g) => {
              // Roll up the group's status. All-same → that status;
              // anything mixed surfaces as "mixed" so it's clear at a glance.
              const distinct = new Set(g.lines.map((l) => l.status));
              const rollupStatus = distinct.size === 1 ? g.lines[0].status : "mixed";
              const badgeClass =
                rollupStatus === "accepted" || rollupStatus === "fulfilled"
                  ? "badge-green"
                  : rollupStatus === "declined"
                    ? "badge-red"
                    : "badge-gold";
              // Dedupe admin responses across lines of the same group.
              const seen = new Set<string>();
              const adminResponses = g.lines
                .map((l) => l.admin_response)
                .filter((r): r is string => Boolean(r) && (seen.has(r!) ? false : (seen.add(r!), true)));
              return (
                <div key={g.key} className="bg-white rounded-xl border border-farm-dark/5 p-4 opacity-90">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-farm-dark">
                        {formatDeliveryDate(g.needed_by_date)}
                        {g.event_name && (
                          <span className="text-farm-muted font-normal"> · {g.event_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-farm-muted mt-0.5">
                        {g.restaurant_name} · {g.chef_name}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 ${badgeClass}`}>{rollupStatus}</span>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {g.lines.map((l) => (
                      <li key={l.id} className="text-sm flex items-center justify-between gap-3">
                        <span className="text-farm-dark/90 truncate">
                          <span className="font-medium">{l.quantity}</span>{" "}
                          <span className="text-farm-muted">{l.unit?.toUpperCase()}</span>{" "}
                          {l.item_name}
                        </span>
                        {distinct.size > 1 && (
                          <span className="text-[10px] tracking-wider uppercase text-farm-muted">
                            {l.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {adminResponses.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {adminResponses.map((r, i) => (
                        <p key={i} className="text-xs text-farm-dark/80 italic pl-3 border-l-2 border-farm-green/50">
                          {r}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
