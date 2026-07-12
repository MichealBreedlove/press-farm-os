"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDeliveryDate, todayPacific } from "@/lib/utils";

interface ItemRow {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  default_price: number | null;
  unit_prices: Record<string, number> | null;
}

interface HistoryEntry {
  id: string;
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

interface Category {
  value: string;
  label: string;
}

interface Props {
  restaurantName: string;
  categories: Category[];
  itemsByCategory: Record<string, ItemRow[]>;
  history: HistoryEntry[];
}

interface DraftLine {
  // local id only — server assigns the real row id on submit
  draftId: string;
  item: ItemRow;
  quantity: string;
  unit: string;
}

function firstUnitOf(item: ItemRow): string {
  return String(item.unit_type ?? "").split(",")[0]?.trim() ?? "";
}

function unitsFor(item: ItemRow): string[] {
  return String(item.unit_type ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EventsClient({ restaurantName, categories, itemsByCategory, history }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const todayISO = todayPacific();

  // Event-level metadata — shared across every line in this submission.
  const [neededBy, setNeededBy] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Item picker state
  const [category, setCategory] = useState(categories[0]?.value ?? "flowers");
  const [search, setSearch] = useState("");

  // The list of lines being staged. Submission sends them as one batch
  // with a shared event_group_id so admin can accept/decline together.
  const [draft, setDraft] = useState<DraftLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Items available for the current category, filtered by search.
  const visibleItems = useMemo(() => {
    const pool = itemsByCategory[category] ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((i) => i.name.toLowerCase().includes(q));
  }, [itemsByCategory, category, search]);

  // Quick lookup: which item_ids already have a draft line, so the
  // picker can show "Added" instead of "+ Add" for those.
  const stagedItemIds = useMemo(
    () => new Set(draft.map((d) => d.item.id)),
    [draft],
  );

  function addLine(item: ItemRow) {
    if (stagedItemIds.has(item.id)) return;
    setDraft((prev) => [
      ...prev,
      {
        draftId: `${item.id}-${Date.now()}`,
        item,
        quantity: "",
        unit: firstUnitOf(item),
      },
    ]);
  }

  function removeLine(draftId: string) {
    setDraft((prev) => prev.filter((l) => l.draftId !== draftId));
  }

  function updateLine(draftId: string, patch: Partial<Pick<DraftLine, "quantity" | "unit">>) {
    setDraft((prev) => prev.map((l) => (l.draftId === draftId ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (draft.length === 0) return setError("Add at least one item");
    if (!neededBy) return setError("Pick a needed-by date");
    if (neededBy < todayISO) return setError("Needed-by date must be today or later");

    // Validate every staged line before round-tripping to the server.
    const items: { item_id: string; quantity: number; unit: string }[] = [];
    for (const line of draft) {
      const q = Number(line.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        return setError(`Quantity for ${line.item.name} must be greater than 0`);
      }
      if (!line.unit) return setError(`Pick a unit for ${line.item.name}`);
      items.push({ item_id: line.item.id, quantity: q, unit: line.unit });
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/event-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          needed_by_date: neededBy,
          event_name: eventName.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit");
      setSuccess(
        items.length === 1
          ? "Request sent. You'll get an email once it's confirmed."
          : `${items.length} items sent. You'll get an email once they're confirmed.`,
      );
      // Reset the form for the next event.
      setDraft([]);
      setNeededBy("");
      setEventName("");
      setNotes("");
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Group history by event_group_id so each submission renders as one
  // event card with all its lines. Rows without a group (legacy 041
  // single-item rows) render as their own card keyed by row id.
  const historyGroups = useMemo(() => {
    type Group = {
      key: string;
      groupId: string | null;
      needed_by_date: string;
      event_name: string | null;
      notes: string | null;
      created_at: string;
      lines: HistoryEntry[];
    };
    const map = new Map<string, Group>();
    for (const h of history) {
      const key = h.event_group_id ?? `solo:${h.id}`;
      const existing = map.get(key);
      if (existing) {
        existing.lines.push(h);
      } else {
        map.set(key, {
          key,
          groupId: h.event_group_id,
          needed_by_date: h.needed_by_date,
          event_name: h.event_name,
          notes: h.notes,
          created_at: h.created_at,
          lines: [h],
        });
      }
    }
    // Sort by date desc then created_at desc — same ordering as the SQL
    // returned, just preserved after the group reduction.
    return Array.from(map.values()).sort((a, b) => {
      if (a.needed_by_date !== b.needed_by_date)
        return a.needed_by_date < b.needed_by_date ? 1 : -1;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }, [history]);

  return (
    <div className="space-y-6">
      <p className="text-xs text-farm-muted">
        Filing as <span className="font-semibold text-farm-dark">{restaurantName}</span>
      </p>

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

      <form onSubmit={handleSubmit} className="card p-4 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-farm-dark">Event details</h3>
          <p className="text-xs text-farm-muted mt-0.5">
            Same date, name, and notes apply to every item below.
          </p>
        </div>

        <div>
          <label className="block text-xs text-farm-muted mb-1">Needed by</label>
          <input
            type="date"
            value={neededBy}
            min={todayISO}
            onChange={(e) => setNeededBy(e.target.value)}
            className="input-field"
          />
          <p className="text-[11px] text-farm-muted/80 mt-1">
            Any future date — Press Farm will harvest for that day even if it&rsquo;s off the Thu / Sat / Mon schedule.
          </p>
        </div>

        <div>
          <label className="block text-xs text-farm-muted mb-1">Event name (optional)</label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="input-field"
            placeholder="Wine club dinner, private party, etc."
          />
        </div>

        <div>
          <label className="block text-xs text-farm-muted mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field min-h-[60px]"
            placeholder="Anything that helps us harvest the right thing"
          />
        </div>

        <hr className="border-farm-dark/10" />

        <div>
          <h3 className="text-sm font-semibold text-farm-dark">Items</h3>
          <p className="text-xs text-farm-muted mt-0.5">
            Browse the catalog and add as many as you need. Each one becomes a line on the same event request.
          </p>
        </div>

        {/* Staged lines list */}
        {draft.length > 0 && (
          <div className="space-y-2">
            {draft.map((line) => {
              const units = unitsFor(line.item);
              return (
                <div key={line.draftId} className="bg-farm-cream/50 rounded-xl border border-farm-dark/5 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-farm-dark flex-1 min-w-0 truncate">
                      {line.item.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.draftId)}
                      className="text-xs text-farm-muted hover:text-red-600 min-h-0 min-w-0 px-1"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.draftId, { quantity: e.target.value })}
                      placeholder="Qty"
                      className="input-field"
                      aria-label={`Quantity for ${line.item.name}`}
                    />
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(line.draftId, { unit: e.target.value })}
                      className="input-field"
                      disabled={units.length === 0}
                      aria-label={`Unit for ${line.item.name}`}
                    >
                      {units.length === 0 && <option value="">—</option>}
                      {units.map((u) => (
                        <option key={u} value={u}>{u.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Item picker */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-farm-muted mb-1">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => { setCategory(c.value); setSearch(""); }}
                  className={`min-h-[44px] rounded-xl border text-xs font-medium px-2 transition-colors ${
                    category === c.value
                      ? "bg-farm-green text-white border-farm-green"
                      : "bg-white text-farm-dark/80 border-farm-dark/10"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="search"
            placeholder="Search this category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
          />

          <div className="border border-farm-dark/10 rounded-xl divide-y divide-farm-dark/5 max-h-72 overflow-y-auto bg-white">
            {visibleItems.length === 0 ? (
              <p className="text-xs text-farm-muted text-center py-6">
                {search ? `No items match "${search}".` : "No items in this category."}
              </p>
            ) : (
              visibleItems.map((item) => {
                const staged = stagedItemIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addLine(item)}
                    disabled={staged}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left min-h-[44px] hover:bg-farm-cream/40 disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <span className="text-sm text-farm-dark truncate">{item.name}</span>
                    <span className={`text-xs font-medium flex-shrink-0 ${staged ? "text-farm-muted" : "text-farm-green"}`}>
                      {staged ? "Added" : "+ Add"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || draft.length === 0}
          className="btn-primary w-full text-sm font-medium disabled:opacity-50"
        >
          {submitting
            ? "Sending…"
            : draft.length === 0
              ? "Add an item to submit"
              : `Send Request (${draft.length} ${draft.length === 1 ? "item" : "items"})`}
        </button>
      </form>

      {/* History — one card per event group */}
      <div>
        <p className="section-eyebrow with-flower text-farm-muted mb-2">
          Your requests ({historyGroups.length})
        </p>
        {historyGroups.length === 0 ? (
          <p className="text-sm text-farm-muted text-center py-6">No requests yet.</p>
        ) : (
          <div className="space-y-2">
            {historyGroups.map((g) => (
              <div key={g.key} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-farm-dark">
                      {formatDeliveryDate(g.needed_by_date)}
                    </p>
                    {g.event_name && (
                      <p className="text-xs text-farm-muted mt-0.5">{g.event_name}</p>
                    )}
                  </div>
                  <GroupStatus lines={g.lines} />
                </div>

                <ul className="space-y-1.5">
                  {g.lines.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-farm-dark/90 truncate">
                        <span className="font-medium">{l.quantity}</span>{" "}
                        <span className="text-farm-muted">{l.unit?.toUpperCase()}</span>{" "}
                        {l.item_name}
                      </span>
                      <StatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>

                {g.notes && (
                  <p className="text-xs text-farm-muted italic pl-3 border-l-2 border-pf-master-gold/40">
                    {g.notes}
                  </p>
                )}
                {/* Surface the admin response — same note applies to the
                    whole group, so dedupe across lines. */}
                {(() => {
                  const seen = new Set<string>();
                  const responses = g.lines
                    .map((l) => l.admin_response)
                    .filter((r): r is string => Boolean(r) && (seen.has(r!) ? false : (seen.add(r!), true)));
                  if (responses.length === 0) return null;
                  return (
                    <div className="space-y-1.5">
                      {responses.map((r, i) => (
                        <p key={i} className="text-xs text-farm-dark/80 pl-3 border-l-2 border-farm-green/50">
                          <span className="text-farm-muted">Note from Press Farm: </span>
                          {r}
                        </p>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Roll up a group's per-line statuses into a single badge. Mixed states
 * show as "Mixed" so the chef knows to inspect individual lines.
 */
function GroupStatus({ lines }: { lines: HistoryEntry[] }) {
  if (lines.length === 1) return <StatusBadge status={lines[0].status} />;
  const distinct = new Set(lines.map((l) => l.status));
  if (distinct.size === 1) return <StatusBadge status={lines[0].status} />;
  return <span className="badge-gold flex-shrink-0">mixed</span>;
}

function StatusBadge({ status }: { status: HistoryEntry["status"] }) {
  const map: Record<HistoryEntry["status"], string> = {
    pending: "badge-gold",
    accepted: "badge-green",
    declined: "badge-red",
    fulfilled: "badge-green",
  };
  return <span className={`${map[status]} flex-shrink-0`}>{status}</span>;
}
