"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Search } from "lucide-react";

interface Entry {
  id: string;
  item_name: string;
  category: string;
  season: string;
  notes: string | null;
}

const SEASONS = [
  { key: "early_winter", label: "Early Winter", dates: "12/15–1/15", month: 0 },
  { key: "late_winter", label: "Late Winter", dates: "1/15–3/1", month: 1 },
  { key: "early_spring", label: "Early Spring", dates: "3/1–4/1", month: 2.5 },
  { key: "late_spring", label: "Late Spring", dates: "4/1–6/1", month: 4 },
  { key: "early_summer", label: "Early Summer", dates: "6/1–7/1", month: 5.5 },
  { key: "summer", label: "Summer", dates: "7/1–9/1", month: 7 },
  { key: "late_summer", label: "Late", dates: "9/1–10/1", month: 8.5 },
  { key: "early_fall", label: "Early Fall", dates: "10/1–11/1", month: 9.5 },
  { key: "late_fall", label: "Late Fall", dates: "11/1–12/15", month: 11 },
];

const CATEGORIES = [
  { key: "micro", label: "Micro", color: "bg-emerald-500" },
  { key: "flowers", label: "Flowers", color: "bg-pink-500" },
  { key: "leaf", label: "Leaf", color: "bg-green-600" },
  { key: "brassicas", label: "Brassicas", color: "bg-blue-500" },
  { key: "roots", label: "Roots", color: "bg-amber-600" },
  { key: "fruit", label: "Fruit", color: "bg-red-500" },
  { key: "wilds", label: "Wilds", color: "bg-purple-500" },
  { key: "oils", label: "Oils", color: "bg-yellow-600" },
];

const CATEGORY_COLORS: Record<string, string> = {};
for (const c of CATEGORIES) CATEGORY_COLORS[c.key] = c.color;

export function CropPlanClient({ entries, farmId }: { entries: Entry[]; farmId: string }) {
  const router = useRouter();
  const [view, setView] = useState<"timeline" | "season">("timeline");
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCat, setAddCat] = useState("micro");
  const [addSeasons, setAddSeasons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Group entries by item_name for timeline view
  const itemTimelines = useMemo(() => {
    const map: Record<string, { name: string; categories: Set<string>; seasons: Set<string> }> = {};
    for (const e of entries) {
      if (filterCat !== "all" && e.category !== filterCat) continue;
      if (search && !e.item_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (!map[e.item_name]) map[e.item_name] = { name: e.item_name, categories: new Set(), seasons: new Set() };
      map[e.item_name].categories.add(e.category);
      map[e.item_name].seasons.add(e.season);
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, filterCat, search]);

  // Group entries by season for season view
  const bySeason = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const s of SEASONS) map[s.key] = {};
    for (const e of entries) {
      if (search && !e.item_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (!map[e.season]) map[e.season] = {};
      if (!map[e.season][e.category]) map[e.season][e.category] = [];
      if (!map[e.season][e.category].includes(e.item_name)) {
        map[e.season][e.category].push(e.item_name);
      }
    }
    return map;
  }, [entries, search]);

  async function handleAdd() {
    if (!addName.trim() || addSeasons.length === 0) return;
    setSaving(true);
    for (const season of addSeasons) {
      await fetch("/api/crop-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farm_id: farmId, item_name: addName.trim(), category: addCat, season }),
      });
    }
    setAddName("");
    setAddSeasons([]);
    setShowAdd(false);
    setSaving(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch("/api/crop-plan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  function toggleSeason(key: string) {
    setAddSeasons((prev) => prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Controls */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search crops..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-1.5 px-4 py-2.5 text-sm"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => setView("timeline")}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors min-h-0 ${
            view === "timeline" ? "bg-white text-farm-green shadow-sm" : "text-gray-500"
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setView("season")}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors min-h-0 ${
            view === "season" ? "bg-white text-farm-green shadow-sm" : "text-gray-500"
          }`}
        >
          By Season
        </button>
      </div>

      {/* Category filter */}
      {view === "timeline" && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterCat("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-0 whitespace-nowrap ${
              filterCat === "all" ? "bg-farm-green text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilterCat(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-0 whitespace-nowrap ${
                filterCat === c.key ? "bg-farm-green text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm text-farm-dark">Add Crop</h3>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 min-h-0 min-w-0 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Crop Name</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Nasturtium"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={addCat} onChange={(e) => setAddCat(e.target.value)} className="input-field">
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Seasons</label>
            <div className="flex flex-wrap gap-1.5">
              {SEASONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSeason(s.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium min-h-0 transition-colors ${
                    addSeasons.includes(s.key)
                      ? "bg-farm-green text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !addName.trim() || addSeasons.length === 0} className="btn-primary w-full">
            {saving ? "Saving..." : "Add Crop"}
          </button>
        </div>
      )}

      {/* TIMELINE VIEW */}
      {view === "timeline" && (
        <div className="card overflow-hidden">
          {/* Season header row */}
          <div className="flex border-b border-gray-100 bg-gray-50">
            <div className="w-32 flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500">Crop</div>
            <div className="flex-1 flex">
              {SEASONS.map((s) => (
                <div key={s.key} className="flex-1 text-center py-2 text-[9px] font-medium text-gray-400 border-l border-gray-100">
                  {s.label.split(" ")[0]}
                  <br />
                  {s.label.split(" ")[1] ?? ""}
                </div>
              ))}
            </div>
          </div>

          {/* Crop rows */}
          {itemTimelines.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              {entries.length === 0 ? "No crops in plan yet." : "No crops match filter."}
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {itemTimelines.map((item) => {
                const primaryCat = Array.from(item.categories)[0];
                return (
                  <div key={item.name} className="flex items-center hover:bg-gray-50/50">
                    <div className="w-32 flex-shrink-0 px-3 py-2.5">
                      <p className="text-xs font-medium text-farm-dark truncate">{item.name}</p>
                    </div>
                    <div className="flex-1 flex">
                      {SEASONS.map((s) => {
                        const active = item.seasons.has(s.key);
                        return (
                          <div key={s.key} className="flex-1 flex items-center justify-center py-2 border-l border-gray-50">
                            {active && (
                              <div className={`w-full mx-0.5 h-4 rounded-sm ${CATEGORY_COLORS[primaryCat] ?? "bg-gray-400"} opacity-80`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-3">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-sm ${c.color}`} />
                <span className="text-[10px] text-gray-500">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEASON VIEW */}
      {view === "season" && (
        <div className="space-y-4">
          {SEASONS.map((season) => {
            const cats = bySeason[season.key] ?? {};
            const hasItems = Object.values(cats).some((items) => items.length > 0);
            if (!hasItems) return null;

            return (
              <div key={season.key} className="card overflow-hidden">
                <div className="px-4 py-3 bg-farm-green text-white">
                  <h3 className="font-display text-sm">{season.label}</h3>
                  <p className="text-xs text-green-200">{season.dates}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {CATEGORIES.filter((c) => cats[c.key]?.length).map((cat) => (
                    <div key={cat.key} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat.label}</span>
                        <span className="text-xs text-gray-300">({cats[cat.key].length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cats[cat.key].sort().map((name) => {
                          const entry = entries.find((e) => e.item_name === name && e.season === season.key && e.category === cat.key);
                          return (
                            <span
                              key={name}
                              className="inline-flex items-center gap-1 bg-gray-50 text-xs text-gray-700 px-2 py-1 rounded-md group"
                            >
                              {name}
                              {entry && (
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  className="text-gray-300 hover:text-red-500 min-h-0 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-xs text-gray-400 pt-2">
        {entries.length} entries · {new Set(entries.map((e) => e.item_name)).size} unique crops
      </div>
    </div>
  );
}
