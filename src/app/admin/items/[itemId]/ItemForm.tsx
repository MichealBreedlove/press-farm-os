"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ITEM_CATEGORIES, UNIT_TYPES, SEASON_STATUSES, ITEM_SIZES } from "@/lib/constants";
import { PhotoPicker } from "@/components/admin/PhotoPicker";

interface Item {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  default_price: number | null;
  chef_notes: string | null;
  internal_notes: string | null;
  source: string | null;
  is_archived: boolean;
  image_url?: string | null;
  season_status?: string | null;
  season_note?: string | null;
  days_to_maturity?: number | null;
  sow_depth?: string | null;
  plant_spacing?: string | null;
  sun_requirement?: string | null;
  sow_method?: string | null;
  indoor_start_weeks?: number | null;
  growing_notes?: string | null;
  size?: string | null;
  variety?: string | null;
  color?: string | null;
  unit_prices?: Record<string, number> | null;
  is_event_item?: boolean;
}

interface Props {
  item?: Item;
}

export function ItemForm({ item }: Props) {
  const router = useRouter();
  const isNew = !item;

  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? ITEM_CATEGORIES[0].value,
    unit_type: item?.unit_type ?? UNIT_TYPES[0].value,
    default_price: item?.default_price != null ? String(item.default_price) : "",
    chef_notes: item?.chef_notes ?? "",
    internal_notes: item?.internal_notes ?? "",
    source: item?.source ?? "",
    image_url: item?.image_url ?? "",
    season_status: item?.season_status ?? "available",
    season_note: item?.season_note ?? "",
    days_to_maturity: item?.days_to_maturity != null ? String(item.days_to_maturity) : "",
    sow_depth: item?.sow_depth ?? "",
    plant_spacing: item?.plant_spacing ?? "",
    sun_requirement: item?.sun_requirement ?? "",
    sow_method: item?.sow_method ?? "",
    indoor_start_weeks: item?.indoor_start_weeks != null ? String(item.indoor_start_weeks) : "",
    growing_notes: item?.growing_notes ?? "",
    size: item?.size ?? "",
    variety: item?.variety ?? "",
    color: item?.color ?? "",
    is_event_item: item?.is_event_item ?? false,
  });

  // Per-unit prices: { sm: "15.00", lg: "30.00", … } stored as strings while editing
  const [unitPrices, setUnitPrices] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    const src = item?.unit_prices ?? {};
    for (const [k, v] of Object.entries(src)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  });

  function setUnitPrice(unit: string, value: string) {
    setUnitPrices((prev) => ({ ...prev, [unit]: value }));
  }

  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleEventItem() {
    setForm((f) => ({ ...f, is_event_item: !f.is_event_item }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Pack unit_prices into a numeric map, only for currently-selected units with a price
      const selectedUnits = form.unit_type.split(",").map((u) => u.trim()).filter(Boolean);
      const unitPricesPayload: Record<string, number> = {};
      for (const u of selectedUnits) {
        const raw = unitPrices[u];
        if (raw && raw.trim() !== "") {
          const n = parseFloat(raw);
          if (!Number.isNaN(n)) unitPricesPayload[u] = n;
        }
      }

      const body = {
        name: form.name,
        category: form.category,
        unit_type: form.unit_type,
        default_price: form.default_price ? parseFloat(form.default_price) : null,
        unit_prices: unitPricesPayload,
        is_event_item: Boolean(form.is_event_item),
        chef_notes: form.chef_notes || null,
        internal_notes: form.internal_notes || null,
        source: form.source || null,
        image_url: form.image_url || null,
        season_status: form.season_status || "available",
        season_note: form.season_note || null,
        days_to_maturity: form.days_to_maturity ? parseInt(form.days_to_maturity) : null,
        sow_depth: form.sow_depth || null,
        plant_spacing: form.plant_spacing || null,
        sun_requirement: form.sun_requirement || null,
        sow_method: form.sow_method || null,
        indoor_start_weeks: form.indoor_start_weeks ? parseInt(form.indoor_start_weeks) : null,
        growing_notes: form.growing_notes || null,
        size: form.size || null,
        variety: form.variety || null,
        color: form.color || null,
      };

      const res = await fetch(isNew ? "/api/items" : `/api/items/${item!.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");

      router.push("/admin/items");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!item) return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: !item.is_archived }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      router.push("/admin/items");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Type + Variety + Color */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="form-label">Type *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Turnip, Basil"
            className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
        <div>
          <label className="form-label">Variety</label>
          <input
            type="text"
            value={form.variety}
            onChange={(e) => set("variety", e.target.value)}
            placeholder="e.g. Hakurei"
            className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
        <div>
          <label className="form-label">Color</label>
          <input
            type="text"
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
            placeholder="e.g. Purple, Red"
            className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="form-label">Category *</label>
        <select
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
          className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
        >
          {ITEM_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Event Item toggle — when on, this item appears in the chef order form
          under a separate "Events Menu" section instead of the regular menu. */}
      <label
        className={`flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
          form.is_event_item
            ? "bg-pf-master-violet/10 border border-pf-master-violet/30"
            : "bg-farm-cream/40 border border-farm-dark/5 hover:bg-farm-cream/60"
        }`}
      >
        <div>
          <p className="text-sm font-medium text-farm-dark">Event item</p>
          <p className="text-xs text-farm-muted mt-0.5">
            {form.is_event_item
              ? "Shown to chefs under the Events Menu section"
              : "Toggle on for items only ordered for special events"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleEventItem}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_event_item ? "bg-pf-master-violet" : "bg-gray-300"}`}
          aria-pressed={form.is_event_item}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_event_item ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </label>

      {/* Unit (multi-select with per-unit pricing).
          Each selected container chip reveals its own price input. */}
      <div>
        <label className="form-label">Containers &amp; Pricing *</label>
        <div className="flex flex-wrap gap-1.5">
          {UNIT_TYPES.map((u) => {
            const units = form.unit_type ? form.unit_type.split(",").map((v) => v.trim()).filter(Boolean) : [];
            const selected = units.includes(u.value);
            return (
              <button
                key={u.value}
                type="button"
                onClick={() => {
                  const next = selected ? units.filter((v) => v !== u.value) : [...units, u.value];
                  // Always keep at least one unit (the field is required)
                  set("unit_type", next.length > 0 ? next.join(",") : u.value);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-0 transition-colors ${
                  selected ? "bg-farm-green text-white" : "bg-farm-cream/60 text-farm-muted hover:bg-gray-200"
                }`}
                title={u.description}
              >
                {u.description}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-farm-muted/70 mt-2">
          Tap every container this item ships in. Chefs will see a separate quantity per container.
        </p>

        {/* Per-unit price inputs — one row per currently selected container */}
        {(() => {
          const selected = form.unit_type
            ? form.unit_type.split(",").map((v) => v.trim()).filter(Boolean)
            : [];
          if (selected.length === 0) return null;
          return (
            <div className="mt-3 space-y-2 bg-farm-cream/40 rounded-xl p-3 border border-farm-dark/5">
              <p className="text-[11px] text-farm-muted uppercase tracking-wider">Price per container</p>
              {selected.map((value) => {
                const meta = UNIT_TYPES.find((u) => u.value === value);
                const label = meta?.description ?? value.toUpperCase();
                return (
                  <div key={value} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-farm-dark">{label}</span>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-farm-muted">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={unitPrices[value] ?? ""}
                        onChange={(e) => setUnitPrice(value, e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-farm-dark/10 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green text-right"
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-farm-muted/70 leading-relaxed pt-1">
                Leave blank to fall back to the Default Price below. Order line totals freeze the
                price at the moment the chef submits, so changes here only affect future orders.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Sizes (multi-select + custom) */}
      <div>
        <label className="form-label">Sizes</label>
        <div className="flex flex-wrap gap-1.5">
          {ITEM_SIZES.map((s) => {
            const sizes = form.size ? form.size.split(", ").filter(Boolean) : [];
            const selected = sizes.includes(s.label);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  const next = selected ? sizes.filter((v) => v !== s.label) : [...sizes, s.label];
                  set("size", next.join(", "));
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-0 transition-colors ${
                  selected ? "bg-farm-green text-white" : "bg-farm-cream/60 text-farm-muted hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={form.size}
          onChange={(e) => set("size", e.target.value)}
          placeholder="Or type custom sizes: e.g. Dime - Nickel, Quarter, Palm"
          className="w-full border border-farm-dark/10 rounded-xl px-3 py-2 text-xs mt-2 focus:outline-none focus:ring-2 focus:ring-farm-green text-farm-muted/90"
        />
      </div>

      {/* Default / fallback price — used for any container without an explicit per-unit price */}
      <div>
        <label className="form-label">Default Price ($) — fallback</label>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.default_price}
          onChange={(e) => set("default_price", e.target.value)}
          placeholder="0.00"
          className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
        <p className="text-[11px] text-farm-muted/70 mt-1.5">
          Used only when a container above has no price set.
        </p>
      </div>

      {/* Chef Notes */}
      <div>
        <label className="form-label">Chef Notes</label>
        <input
          type="text"
          value={form.chef_notes}
          onChange={(e) => set("chef_notes", e.target.value)}
          placeholder="Visible to chefs when ordering"
          className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
      </div>

      {/* Internal Notes */}
      <div>
        <label className="form-label">Internal Notes</label>
        <input
          type="text"
          value={form.internal_notes}
          onChange={(e) => set("internal_notes", e.target.value)}
          placeholder="Admin-only notes"
          className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
      </div>

      {/* Source */}
      <div>
        <label className="form-label">Source</label>
        <input
          type="text"
          value={form.source}
          onChange={(e) => set("source", e.target.value)}
          placeholder="e.g. Baker Creek, Johnny's Seeds"
          className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
      </div>

      {/* Photo picker */}
      <PhotoPicker
        value={form.image_url || null}
        onChange={(url) => set("image_url", url ?? "")}
      />

      {/* Growing Conditions */}
      <div className="border-t border-farm-dark/5 pt-4 mt-2">
        <h3 className="font-display text-sm text-farm-dark mb-3">Growing Conditions</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">Days to Maturity</label>
            <input type="number" value={form.days_to_maturity} onChange={(e) => set("days_to_maturity", e.target.value)} placeholder="e.g. 60" className="input-field" />
          </div>
          <div>
            <label className="form-label">Sow Depth</label>
            <input type="text" value={form.sow_depth} onChange={(e) => set("sow_depth", e.target.value)} placeholder="e.g. 1/4 in" className="input-field" />
          </div>
          <div>
            <label className="form-label">Plant Spacing</label>
            <input type="text" value={form.plant_spacing} onChange={(e) => set("plant_spacing", e.target.value)} placeholder="e.g. 8-12 in" className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <label className="form-label">Sun</label>
            <select value={form.sun_requirement} onChange={(e) => set("sun_requirement", e.target.value)} className="input-field">
              <option value="">Not set</option>
              <option value="full_sun">Full Sun</option>
              <option value="part_shade">Part Shade</option>
              <option value="sun_part_shade">Sun/Part Shade</option>
              <option value="shade">Shade</option>
            </select>
          </div>
          <div>
            <label className="form-label">Sow Method</label>
            <select value={form.sow_method} onChange={(e) => set("sow_method", e.target.value)} className="input-field">
              <option value="">Not set</option>
              <option value="direct_seed">Direct Seed</option>
              <option value="transplant">Transplant</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className="form-label">Start Indoors</label>
            <input type="number" value={form.indoor_start_weeks} onChange={(e) => set("indoor_start_weeks", e.target.value)} placeholder="weeks" className="input-field" />
          </div>
        </div>
        <div className="mt-3">
          <label className="form-label">Growing Notes</label>
          <textarea value={form.growing_notes} onChange={(e) => set("growing_notes", e.target.value)} rows={2} placeholder="Cultivation tips, harvest info..." className="input-field resize-none" />
        </div>
      </div>

      {/* Season Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Season Status</label>
          <select
            value={form.season_status}
            onChange={(e) => set("season_status", e.target.value)}
            className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          >
            {SEASON_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Season Note</label>
          <input
            type="text"
            value={form.season_note}
            onChange={(e) => set("season_note", e.target.value)}
            placeholder="e.g. 2 weeks left"
            className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Save */}
      <button
        type="submit"
        disabled={saving}
        className="btn-primary w-full min-h-[48px] text-sm font-semibold disabled:opacity-50"
      >
        {saving ? "Saving…" : isNew ? "Create Item" : "Save Changes"}
      </button>

      {/* Archive toggle (edit only) */}
      {!isNew && (
        <button
          type="button"
          onClick={handleArchiveToggle}
          disabled={archiving}
          className={`w-full min-h-[48px] rounded-xl border text-sm font-medium disabled:opacity-50 transition-colors ${
            item!.is_archived
              ? "border-farm-green text-farm-green hover:bg-farm-green-light"
              : "border-farm-dark/10 text-farm-muted hover:bg-farm-cream/40"
          }`}
        >
          {archiving ? "…" : item!.is_archived ? "Unarchive Item" : "Archive Item"}
        </button>
      )}
    </form>
  );
}
