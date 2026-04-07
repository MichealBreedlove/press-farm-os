"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ITEM_CATEGORIES, UNIT_TYPES } from "@/lib/constants";

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
  });

  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        category: form.category,
        unit_type: form.unit_type,
        default_price: form.default_price ? parseFloat(form.default_price) : null,
        chef_notes: form.chef_notes || null,
        internal_notes: form.internal_notes || null,
        source: form.source || null,
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
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Item Name *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Nasturtium, Basil, Heirloom Tomato"
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Category *</label>
        <select
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          {ITEM_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Unit Type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Unit *</label>
        <select
          value={form.unit_type}
          onChange={(e) => set("unit_type", e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          {UNIT_TYPES.map((u) => (
            <option key={u.value} value={u.value}>{u.label} — {u.description}</option>
          ))}
        </select>
      </div>

      {/* Default Price */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Default Price ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.default_price}
          onChange={(e) => set("default_price", e.target.value)}
          placeholder="0.00"
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Chef Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Chef Notes</label>
        <input
          type="text"
          value={form.chef_notes}
          onChange={(e) => set("chef_notes", e.target.value)}
          placeholder="Visible to chefs when ordering"
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Internal Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Internal Notes</label>
        <input
          type="text"
          value={form.internal_notes}
          onChange={(e) => set("internal_notes", e.target.value)}
          placeholder="Admin-only notes"
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Source */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
        <input
          type="text"
          value={form.source}
          onChange={(e) => set("source", e.target.value)}
          placeholder="e.g. Baker Creek, Johnny's Seeds"
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Save */}
      <button
        type="submit"
        disabled={saving}
        className="w-full min-h-[48px] bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-green-800 transition-colors"
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
              ? "border-green-200 text-green-700 hover:bg-green-50"
              : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          {archiving ? "…" : item!.is_archived ? "Unarchive Item" : "Archive Item"}
        </button>
      )}
    </form>
  );
}
