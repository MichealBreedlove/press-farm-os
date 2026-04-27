"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2 } from "lucide-react";

interface Pack {
  id: string;
  container_type: string;
  display_name: string;
  on_hand: number;
  reorder_threshold: number;
  unit_cost: number | null;
  notes: string | null;
}

export function PacksClient({ initialPacks }: { initialPacks: Pack[] }) {
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>(initialPacks);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPack, setNewPack] = useState({
    container_type: "",
    display_name: "",
    on_hand: "0",
    reorder_threshold: "10",
    unit_cost: "",
  });

  async function adjustQty(pack: Pack, delta: number) {
    const newQty = Math.max(0, pack.on_hand + delta);
    setSaving(pack.id);
    try {
      const res = await fetch(`/api/packs/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on_hand: newQty }),
      });
      if (res.ok) {
        setPacks((prev) => prev.map((p) => (p.id === pack.id ? { ...p, on_hand: newQty } : p)));
      }
    } finally {
      setSaving(null);
    }
  }

  async function setQty(pack: Pack, raw: string) {
    const newQty = Math.max(0, parseInt(raw) || 0);
    setSaving(pack.id);
    try {
      await fetch(`/api/packs/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on_hand: newQty }),
      });
      setPacks((prev) => prev.map((p) => (p.id === pack.id ? { ...p, on_hand: newQty } : p)));
    } finally {
      setSaving(null);
    }
  }

  async function setThreshold(pack: Pack, raw: string) {
    const t = Math.max(0, parseInt(raw) || 0);
    setSaving(pack.id);
    try {
      await fetch(`/api/packs/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder_threshold: t }),
      });
      setPacks((prev) => prev.map((p) => (p.id === pack.id ? { ...p, reorder_threshold: t } : p)));
    } finally {
      setSaving(null);
    }
  }

  async function deletePack(id: string) {
    if (!confirm("Delete this container type?")) return;
    await fetch(`/api/packs/${id}`, { method: "DELETE" });
    setPacks((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container_type: newPack.container_type,
          display_name: newPack.display_name,
          on_hand: parseInt(newPack.on_hand) || 0,
          reorder_threshold: parseInt(newPack.reorder_threshold) || 10,
          unit_cost: newPack.unit_cost ? parseFloat(newPack.unit_cost) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setPacks((prev) => [...prev, json.data]);
      setNewPack({ container_type: "", display_name: "", on_hand: "0", reorder_threshold: "10", unit_cost: "" });
      setShowAdd(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  const lowStock = packs.filter((p) => p.on_hand <= p.reorder_threshold);

  return (
    <div className="space-y-4">
      {/* Reorder alerts */}
      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-orange-800 mb-1">
            ⚠ {lowStock.length} container{lowStock.length !== 1 ? "s" : ""} below reorder threshold
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {lowStock.map((p) => (
              <span
                key={p.id}
                className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium"
              >
                {p.display_name}: {p.on_hand} left
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add new */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary w-full text-sm font-medium flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Container Type
        </button>
      ) : (
        <form onSubmit={handleAdd} className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">New Container Type</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Code (e.g. lg)</label>
              <input
                required value={newPack.container_type}
                onChange={(e) => setNewPack({ ...newPack, container_type: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display name</label>
              <input
                required value={newPack.display_name}
                onChange={(e) => setNewPack({ ...newPack, display_name: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">On hand</label>
              <input type="number" min="0" value={newPack.on_hand}
                onChange={(e) => setNewPack({ ...newPack, on_hand: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reorder at</label>
              <input type="number" min="0" value={newPack.reorder_threshold}
                onChange={(e) => setNewPack({ ...newPack, reorder_threshold: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">$ each</label>
              <input type="number" step="0.01" value={newPack.unit_cost}
                onChange={(e) => setNewPack({ ...newPack, unit_cost: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={adding} className="btn-primary flex-1 text-sm">{adding ? "..." : "Save"}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Pack list */}
      <div className="space-y-2">
        {packs.map((pack) => {
          const isLow = pack.on_hand <= pack.reorder_threshold;
          return (
            <div
              key={pack.id}
              className={`card p-4 ${isLow ? "border-orange-300 bg-orange-50/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{pack.display_name}</p>
                    <span className="text-[10px] text-gray-400 font-mono">{pack.container_type}</span>
                  </div>
                  {isLow && (
                    <p className="text-xs text-orange-600 font-medium mt-0.5">Low stock — reorder soon</p>
                  )}
                </div>
                <button
                  onClick={() => deletePack(pack.id)}
                  className="text-gray-300 hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Qty controls */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => adjustQty(pack, -1)}
                  disabled={saving === pack.id || pack.on_hand <= 0}
                  className="w-11 h-11 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center disabled:opacity-30"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={pack.on_hand}
                  onChange={(e) => setQty(pack, e.target.value)}
                  className="w-20 h-11 text-center text-lg font-bold text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
                <button
                  onClick={() => adjustQty(pack, 1)}
                  disabled={saving === pack.id}
                  className="w-11 h-11 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center disabled:opacity-30"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-400 ml-1">on hand</span>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Reorder at:</span>
                <input
                  type="number"
                  min="0"
                  value={pack.reorder_threshold}
                  onChange={(e) => setThreshold(pack, e.target.value)}
                  className="w-16 h-8 text-center text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-farm-green"
                />
                {pack.unit_cost != null && (
                  <span className="text-xs text-gray-400 ml-auto">
                    ${pack.unit_cost.toFixed(2)} each
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {packs.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            No containers tracked yet. Add one above.
          </p>
        )}
      </div>
    </div>
  );
}
