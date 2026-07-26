"use client";
import { useState, useTransition } from "react";
import { todayPacific } from "@/lib/utils";
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_HINTS,
  MONTH_ABBR,
  valueBasisFor,
  type PlantingLifecycle,
} from "@/lib/production-value/constants";

export type Planting = {
  id?: string;
  box_id?: string;
  item_id?: string | null;
  name?: string;
  lifecycle?: PlantingLifecycle;
  planted_date?: string;
  end_date?: string | null;
  value_amount?: number;
  seasonal_months?: number[];
  status?: string;
  notes?: string | null;
};

type Props = {
  boxId: string;
  items: Array<{ id: string; name: string }>;
  initial?: Planting;
  onDone: () => void;
  onCancel: () => void;
};

export function PlantingForm({ boxId, items, initial, onDone, onCancel }: Props) {
  const isEdit = !!initial?.id;
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    item_id: initial?.item_id ?? "",
    lifecycle: (initial?.lifecycle ?? "annual") as PlantingLifecycle,
    planted_date: initial?.planted_date ?? todayPacific(),
    end_date: initial?.end_date ?? "",
    value_amount: initial?.value_amount ?? 0,
    seasonal_months: initial?.seasonal_months ?? [],
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const isAnnual = form.lifecycle === "annual";
  const isDormant = form.lifecycle === "perennial_dormant";
  const basis = valueBasisFor(form.lifecycle);

  function toggleMonth(m: number) {
    update(
      "seasonal_months",
      form.seasonal_months.includes(m)
        ? form.seasonal_months.filter((x) => x !== m)
        : [...form.seasonal_months, m].sort((a, b) => a - b),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const payload = {
        box_id: boxId,
        item_id: form.item_id || null,
        name: form.name,
        lifecycle: form.lifecycle,
        planted_date: form.planted_date,
        end_date: isAnnual ? form.end_date : form.end_date || null,
        value_amount: Number(form.value_amount),
        seasonal_months: isDormant ? form.seasonal_months : [],
        status: form.status,
        notes: form.notes,
      };
      const url = isEdit
        ? `/api/planter-boxes/plantings/${initial!.id}`
        : "/api/planter-boxes/plantings";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) onDone();
      else setError((await res.json()).error ?? "Save failed");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-farm-dark/15 p-4 bg-farm-cream/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm">Plant name</span>
          <input className="input-field" value={form.name} required
            onChange={(e) => update("name", e.target.value)} placeholder="Rosemary" />
        </label>
        <label className="block">
          <span className="block text-sm">Linked catalog item (optional)</span>
          <select className="input-field" value={form.item_id ?? ""}
            onChange={(e) => update("item_id", e.target.value)}>
            <option value="">— none —</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-sm">Lifecycle</span>
        <select className="input-field" value={form.lifecycle}
          onChange={(e) => update("lifecycle", e.target.value as PlantingLifecycle)}>
          {(Object.keys(LIFECYCLE_LABELS) as PlantingLifecycle[]).map((k) => (
            <option key={k} value={k}>{LIFECYCLE_LABELS[k]}</option>
          ))}
        </select>
        <p className="text-xs text-farm-muted mt-1">{LIFECYCLE_HINTS[form.lifecycle]}</p>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm">Planted date</span>
          <input type="date" className="input-field" value={form.planted_date} required
            onChange={(e) => update("planted_date", e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm">
            {isAnnual ? "End date (required)" : "Removed date (optional)"}
          </span>
          <input type="date" className="input-field" value={form.end_date ?? ""}
            required={isAnnual}
            onChange={(e) => update("end_date", e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm">
          {basis === "total" ? "Total production value ($)" : "Production value ($/month)"}
        </span>
        <input type="number" min="0" step="1" className="input-field" value={form.value_amount}
          onChange={(e) => update("value_amount", Number(e.target.value))} required />
        <p className="text-xs text-farm-muted mt-1">
          {basis === "total"
            ? "Spread evenly across the plant's life."
            : "Accrues evenly day-by-day while the plant is producing."}
        </p>
      </label>

      {isDormant && (
        <div className="block">
          <span className="block text-sm mb-1">Producing months</span>
          <div className="flex flex-wrap gap-1.5">
            {MONTH_ABBR.map((label, i) => {
              const m = i + 1;
              const on = form.seasonal_months.includes(m);
              return (
                <button type="button" key={m} onClick={() => toggleMonth(m)}
                  className={`px-2 py-1 rounded text-xs border ${
                    on
                      ? "bg-farm-green text-white border-farm-green"
                      : "border-farm-dark/20 text-farm-muted"
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="block">
        <span className="block text-sm">Notes</span>
        <input className="input-field" value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)} />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save planting" : "Add planting"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
