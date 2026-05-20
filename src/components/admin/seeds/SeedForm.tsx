"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SEED_STATUSES,
  SEED_STATUS_LABELS,
  SEED_QUANTITY_UNIT_SUGGESTIONS,
  type SeedStatus,
} from "@/lib/constants";

interface ItemOption {
  id: string;
  name: string;
  category: string;
}

interface InitialValues {
  item_id?: string;
  variety?: string;
  initial_quantity?: number;
  quantity_unit?: string;
  packed_for_year?: number | null;
  purchase_date?: string | null;
  supplier?: string | null;
  cost?: number | null;
  status?: SeedStatus;
  notes?: string | null;
}

interface Props {
  mode: "create" | "edit";
  items: ItemOption[];
  initial?: InitialValues;
  seedId?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export function SeedForm({ mode, items, initial, seedId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [itemId, setItemId] = useState(initial?.item_id ?? "");
  const [variety, setVariety] = useState(initial?.variety ?? "");
  const [initialQty, setInitialQty] = useState(initial?.initial_quantity?.toString() ?? "");
  const [quantityUnit, setQuantityUnit] = useState(initial?.quantity_unit ?? "packets");
  const [packedForYear, setPackedForYear] = useState(initial?.packed_for_year?.toString() ?? "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [status, setStatus] = useState<SeedStatus>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const groupedItems = useMemo(() => {
    const byCategory: Record<string, ItemOption[]> = {};
    for (const it of items) {
      const cat = it.category || "uncategorized";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(it);
    }
    return Object.keys(byCategory).sort().map((cat) => ({ category: cat, items: byCategory[cat] }));
  }, [items]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: Record<string, unknown> = {
      item_id: itemId,
      variety: variety.trim(),
      initial_quantity: parseFloat(initialQty),
      quantity_unit: quantityUnit.trim(),
      packed_for_year: packedForYear ? Number(packedForYear) : null,
      purchase_date: purchaseDate || null,
      supplier: supplier.trim() || null,
      cost: cost ? Number(cost) : null,
      status,
      notes: notes.trim() || null,
    };

    if (!itemId) { setError("Pick a crop"); return; }
    if (!body.variety) { setError("Variety name required"); return; }
    if (!Number.isFinite(body.initial_quantity as number) || (body.initial_quantity as number) < 0) {
      setError("Initial quantity must be a non-negative number"); return;
    }
    if (!body.quantity_unit) { setError("Unit required"); return; }

    startTransition(async () => {
      const url = mode === "create" ? "/api/seeds" : `/api/seeds/${seedId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Save failed");
        return;
      }
      const data = await res.json();
      if (mode === "create") {
        router.push(`/admin/seeds/${data.seed.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </p>
      )}

      <Field label="Crop" required>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          disabled={mode === "edit"}
          required
          className="input-field"
        >
          <option value="">Select a crop…</option>
          {groupedItems.map((group) => (
            <optgroup key={group.category} label={group.category}>
              {group.items.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {mode === "edit" && (
          <p className="text-[11px] text-farm-muted mt-1">
            Crop link can't be changed after creation. Discard this seed and create a new one if it was wrong.
          </p>
        )}
      </Field>

      <Field label="Variety" required>
        <input
          type="text"
          value={variety}
          onChange={(e) => setVariety(e.target.value)}
          required
          placeholder="e.g. Genovese, Cherokee Purple"
          className="input-field"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Initial quantity" required>
          <input
            type="number"
            step="0.01"
            min="0"
            value={initialQty}
            onChange={(e) => setInitialQty(e.target.value)}
            required
            className="input-field"
          />
        </Field>
        <Field label="Unit" required>
          <input
            list="seed-unit-suggestions"
            type="text"
            value={quantityUnit}
            onChange={(e) => setQuantityUnit(e.target.value)}
            required
            placeholder="packets, g, seeds…"
            className="input-field"
          />
          <datalist id="seed-unit-suggestions">
            {SEED_QUANTITY_UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Packed for year">
          <input
            type="number"
            min={CURRENT_YEAR - 10}
            max={CURRENT_YEAR + 2}
            value={packedForYear}
            onChange={(e) => setPackedForYear(e.target.value)}
            placeholder={String(CURRENT_YEAR)}
            className="input-field"
          />
        </Field>
        <Field label="Purchase date">
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="input-field"
          />
        </Field>
      </div>

      <Field label="Supplier">
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Johnny's, Baker Creek, etc."
          className="input-field"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost">
          <input
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="USD"
            className="input-field"
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SeedStatus)}
            className="input-field"
          >
            {SEED_STATUSES.map((s) => (
              <option key={s} value={s}>{SEED_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="input-field"
          placeholder="Lot number, source, observations…"
        />
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 px-4 py-3 rounded-lg bg-farm-green text-white font-medium text-sm min-h-[44px] disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "create" ? "Create seed" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-3 rounded-lg border border-farm-dark/20 text-farm-muted text-sm min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-wider uppercase text-farm-muted mb-1">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
