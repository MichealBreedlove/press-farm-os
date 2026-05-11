"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDeliveryDate } from "@/lib/utils";

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

export function EventsClient({ restaurantName, categories, itemsByCategory, history }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const todayISO = new Date().toISOString().split("T")[0];

  const [category, setCategory] = useState(categories[0]?.value ?? "flowers");
  const [itemId, setItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [neededBy, setNeededBy] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const itemsForCategory = itemsByCategory[category] ?? [];
  const selectedItem = useMemo(
    () => itemsForCategory.find((i) => i.id === itemId) ?? null,
    [itemsForCategory, itemId],
  );

  const unitOptions = useMemo(() => {
    if (!selectedItem) return [] as string[];
    return String(selectedItem.unit_type ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [selectedItem]);

  function pickItem(id: string) {
    setItemId(id);
    const item = itemsForCategory.find((i) => i.id === id);
    const firstUnit = String(item?.unit_type ?? "").split(",")[0]?.trim() ?? "";
    setUnit(firstUnit);
  }

  function pickCategory(cat: string) {
    setCategory(cat);
    setItemId("");
    setUnit("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!itemId) return setError("Pick an item");
    const q = Number(quantity);
    if (!q || q <= 0) return setError("Quantity must be greater than 0");
    if (!unit) return setError("Pick a unit");
    if (!neededBy) return setError("Pick a needed-by date");
    if (neededBy < todayISO) return setError("Needed-by date must be today or later");

    setSubmitting(true);
    try {
      const res = await fetch("/api/event-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          quantity: q,
          unit,
          needed_by_date: neededBy,
          event_name: eventName.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit");
      setSuccess("Request sent. You'll get an email once it's confirmed.");
      setItemId("");
      setQuantity("");
      setUnit("");
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

  return (
    <div className="space-y-6">
      {/* Restaurant context */}
      <p className="text-xs text-farm-muted">
        Filing as <span className="font-semibold text-farm-dark">{restaurantName}</span>
      </p>

      {/* Banners */}
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

      {/* Request form */}
      <form onSubmit={handleSubmit} className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-farm-dark">Request an item</h3>

        <div>
          <label className="block text-xs text-farm-muted mb-1">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => pickCategory(c.value)}
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

        <div>
          <label className="block text-xs text-farm-muted mb-1">Item</label>
          <select
            value={itemId}
            onChange={(e) => pickItem(e.target.value)}
            className="input-field"
          >
            <option value="">— Select —</option>
            {itemsForCategory.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-farm-muted mb-1">Quantity</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-farm-muted mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="input-field"
              disabled={unitOptions.length === 0}
            >
              {unitOptions.length === 0 && <option value="">—</option>}
              {unitOptions.map((u) => (
                <option key={u} value={u}>{u.toUpperCase()}</option>
              ))}
            </select>
          </div>
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
            className="input-field min-h-[80px]"
            placeholder="Anything that helps us harvest the right thing"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send Request"}
        </button>
      </form>

      {/* History */}
      <div>
        <p className="section-eyebrow with-flower text-farm-muted mb-2">
          Your requests ({history.length})
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-farm-muted text-center py-6">No requests yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-farm-dark truncate">
                      {h.quantity} {h.unit?.toUpperCase()} {h.item_name}
                    </p>
                    <p className="text-xs text-farm-muted">
                      {formatDeliveryDate(h.needed_by_date)}
                      {h.event_name ? ` · ${h.event_name}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={h.status} />
                </div>
                {h.notes && (
                  <p className="text-xs text-farm-muted italic mt-2 pl-3 border-l-2 border-pf-master-gold/40">
                    {h.notes}
                  </p>
                )}
                {h.admin_response && (
                  <p className="text-xs text-farm-dark/80 mt-2 pl-3 border-l-2 border-farm-green/50">
                    <span className="text-farm-muted">Note from Press Farm: </span>
                    {h.admin_response}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
