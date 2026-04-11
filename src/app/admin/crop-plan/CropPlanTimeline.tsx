"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, ChevronDown, ChevronRight, X, Trash2, Calendar, Sprout } from "lucide-react";

// ── Types ──
interface Planting {
  id: string;
  crop_name: string;
  variety: string | null;
  category: string | null;
  sow_date: string | null;
  harvest_start: string | null;
  harvest_end: string | null;
  termination_date: string | null;
  days_to_maturity: number | null;
  growing_location: string | null;
  planting_stock: string | null;
  location: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  harvest_unit: string | null;
  avg_price: number | null;
  projected_revenue: number | null;
  status: string;
  notes: string | null;
  item_id: string | null;
  items: { name: string; image_url: string | null; category: string; unit_type: string } | null;
}

interface Item {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  default_price: number | null;
  image_url: string | null;
}

interface LegacyEntry {
  id: string;
  item_name: string;
  category: string;
  season: string;
}

// ── Constants ──
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CAT_COLORS: Record<string, string> = {
  micro: "#10b981", flowers: "#ec4899", leaf: "#22c55e", brassicas: "#3b82f6",
  roots: "#d97706", fruit: "#ef4444", wilds: "#8b5cf6", herbs: "#14b8a6",
  herbs_leaves: "#22c55e", micros_leaves: "#10b981", fruit_veg: "#ef4444",
  kits: "#6b7280", other: "#6b7280",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "badge-blue", planted: "badge-green", growing: "badge-green",
  harvesting: "badge-gold", terminated: "badge-gray", cancelled: "badge-red",
};

const LOCATIONS = [
  "Back Wall", "Corn Field", "Field (Most Sun)", "Field (Next to Corn)",
  "Field (Orchard)", "Field (Passion Fruit)", "Fig Bed", "Flowers Bed",
  "Planter Bed", "Planter Boxes", "Greenhouse", "Other",
];

// ── Helpers ──
function monthFraction(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  return d.getMonth() + d.getDate() / 31;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main Component ──
export function CropPlanTimeline({
  plantings, items, farmId, season, legacyEntries,
}: {
  plantings: Planting[];
  items: Item[];
  farmId: string;
  season: number;
  legacyEntries: LegacyEntry[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPlanting, setSelectedPlanting] = useState<Planting | null>(null);

  // Group plantings by crop_name
  const grouped = useMemo(() => {
    const map: Record<string, Planting[]> = {};
    for (const p of plantings) {
      if (search && !p.crop_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (filterCat !== "all" && p.category !== filterCat) continue;
      if (!map[p.crop_name]) map[p.crop_name] = [];
      map[p.crop_name].push(p);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [plantings, search, filterCat]);

  const categories = useMemo(() => {
    const set = new Set(plantings.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [plantings]);

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const totalPlantings = plantings.length;
  const totalRevenue = plantings.reduce((s, p) => s + (p.projected_revenue ?? 0), 0);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-farm-dark">{totalPlantings}</p>
          <p className="text-[10px] text-gray-400">Plantings</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-farm-green">{grouped.length}</p>
          <p className="text-[10px] text-gray-400">Crops</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-farm-dark">
            {totalRevenue > 0 ? `$${(totalRevenue / 1000).toFixed(1)}K` : "—"}
          </p>
          <p className="text-[10px] text-gray-400">Est. Revenue</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
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
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 px-4 text-sm">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setFilterCat("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-0 whitespace-nowrap ${filterCat === "all" ? "bg-farm-green text-white" : "bg-gray-100 text-gray-500"}`}
        >All</button>
        {categories.map((c) => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-0 whitespace-nowrap ${filterCat === c ? "bg-farm-green text-white" : "bg-gray-100 text-gray-500"}`}
          >{c}</button>
        ))}
      </div>

      {/* Gantt Timeline */}
      <div className="card overflow-hidden overflow-x-auto">
        {/* Month header */}
        <div className="flex border-b border-gray-100 bg-gray-50 sticky top-0 z-10 min-w-[600px]">
          <div className="w-24 sm:w-40 flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500">Crop</div>
          <div className="flex-1 flex">
            {MONTHS.map((m) => (
              <div key={m} className="flex-1 text-center py-2 text-[10px] font-medium text-gray-400 border-l border-gray-100">
                {m}
              </div>
            ))}
          </div>
          <div className="w-20 text-center py-2 text-[10px] font-medium text-gray-400 border-l border-gray-100">Info</div>
        </div>

        {/* Today marker column index */}
        {grouped.length === 0 ? (
          <div className="text-center py-12">
            <Sprout className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No plantings yet</p>
            <button onClick={() => setShowAdd(true)} className="text-sm text-farm-green font-medium mt-2 min-h-0">
              + Add your first planting
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
            {grouped.map(([cropName, cropPlantings]) => {
              const isExpanded = expanded.has(cropName);
              const primaryCat = cropPlantings[0]?.category ?? "other";
              const color = CAT_COLORS[primaryCat] ?? "#6b7280";

              return (
                <div key={cropName}>
                  {/* Crop header row */}
                  <div className="flex items-center hover:bg-gray-50/50 cursor-pointer min-w-[600px]" onClick={() => toggleExpand(cropName)}>
                    <div className="w-24 sm:w-40 flex-shrink-0 px-3 py-2.5 flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                      <span className="text-xs font-medium text-farm-dark truncate">{cropName}</span>
                    </div>
                    <div className="flex-1 flex relative" style={{ height: "32px" }}>
                      {/* Aggregate bars for all plantings of this crop */}
                      {cropPlantings.map((p) => {
                        const start = p.sow_date ? monthFraction(p.sow_date) : null;
                        const end = p.harvest_end ?? p.termination_date ?? p.harvest_start;
                        const endF = end ? monthFraction(end) : start ? start + 2 : null;
                        if (start === null || endF === null) return null;
                        const left = `${(start / 12) * 100}%`;
                        const width = `${(Math.max(endF - start, 0.5) / 12) * 100}%`;
                        const harvestStartF = p.harvest_start ? monthFraction(p.harvest_start) : null;

                        return (
                          <div key={p.id} className="absolute top-1/2 -translate-y-1/2" style={{ left, width, height: "12px" }}>
                            {/* Sow to harvest: lighter */}
                            {harvestStartF && harvestStartF > start && (
                              <div
                                className="absolute top-0 left-0 h-full rounded-l-sm opacity-40"
                                style={{
                                  backgroundColor: color,
                                  width: `${((harvestStartF - start) / (endF - start)) * 100}%`,
                                }}
                              />
                            )}
                            {/* Harvest window: full color */}
                            <div
                              className="absolute top-0 h-full rounded-sm opacity-80"
                              style={{
                                backgroundColor: color,
                                left: harvestStartF && harvestStartF > start ? `${((harvestStartF - start) / (endF - start)) * 100}%` : "0",
                                right: "0",
                              }}
                            />
                          </div>
                        );
                      })}
                      {/* Month grid lines */}
                      {MONTHS.map((_, i) => (
                        <div key={i} className="flex-1 border-l border-gray-50" />
                      ))}
                    </div>
                    <div className="w-20 text-center py-2 border-l border-gray-50">
                      <span className="text-[10px] text-gray-400">{cropPlantings.length} planting{cropPlantings.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Expanded: individual plantings */}
                  {isExpanded && cropPlantings.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center bg-gray-50/30 hover:bg-gray-100/50 cursor-pointer border-t border-gray-50 min-w-[600px]"
                      onClick={() => setSelectedPlanting(p)}
                    >
                      <div className="w-24 sm:w-40 flex-shrink-0 pl-8 pr-3 py-2">
                        <p className="text-[11px] text-gray-600 truncate">{p.variety || p.crop_name}</p>
                        <p className="text-[9px] text-gray-400">{p.location ?? "No location"}</p>
                      </div>
                      <div className="flex-1 flex relative" style={{ height: "28px" }}>
                        {(() => {
                          const start = p.sow_date ? monthFraction(p.sow_date) : null;
                          const end = p.harvest_end ?? p.termination_date ?? p.harvest_start;
                          const endF = end ? monthFraction(end) : start ? start + 2 : null;
                          if (start === null || endF === null) return null;
                          const left = `${(start / 12) * 100}%`;
                          const width = `${(Math.max(endF - start, 0.5) / 12) * 100}%`;

                          return (
                            <div className="absolute top-1/2 -translate-y-1/2 rounded-sm text-[8px] text-white font-medium flex items-center px-1 overflow-hidden" style={{ left, width, height: "16px", backgroundColor: color }}>
                              {fmtDate(p.sow_date)} — {fmtDate(p.harvest_end ?? p.harvest_start)}
                            </div>
                          );
                        })()}
                        {MONTHS.map((_, i) => (
                          <div key={i} className="flex-1 border-l border-gray-50" />
                        ))}
                      </div>
                      <div className="w-20 text-center py-2 border-l border-gray-50">
                        <span className={STATUS_COLORS[p.status] ?? "badge-gray"}>{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-3">
          {Object.entries(CAT_COLORS).filter(([k]) => categories.includes(k)).map(([k, c]) => (
            <div key={k} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
              <span className="text-[10px] text-gray-500 capitalize">{k}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add Planting Modal ── */}
      {showAdd && (
        <AddPlantingModal
          items={items}
          farmId={farmId}
          season={season}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); router.refresh(); }}
        />
      )}

      {/* ── Planting Detail Panel ── */}
      {selectedPlanting && (
        <PlantingDetail
          planting={selectedPlanting}
          onClose={() => setSelectedPlanting(null)}
          onDeleted={() => { setSelectedPlanting(null); router.refresh(); }}
          onUpdated={() => { setSelectedPlanting(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ── Add Planting Modal ──
function AddPlantingModal({ items, farmId, season, onClose, onSaved }: {
  items: Item[];
  farmId: string;
  season: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"crop" | "details">("crop");
  const [searchItems, setSearchItems] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [form, setForm] = useState({
    crop_name: "",
    variety: "",
    category: "leaf",
    growing_location: "in_ground",
    planting_stock: "seeds",
    sow_date: new Date().toISOString().split("T")[0],
    days_to_maturity: "30",
    harvest_start: "",
    harvest_end: "",
    location: "",
    quantity: "",
    quantity_unit: "plants",
    harvest_unit: "lg",
    avg_price: "",
    notes: "",
    status: "planned",
  });

  function selectCrop(item: Item) {
    setSelectedItem(item);
    const sowDate = form.sow_date;
    const maturity = parseInt(form.days_to_maturity) || 30;
    const harvestStart = new Date(sowDate + "T12:00:00");
    harvestStart.setDate(harvestStart.getDate() + maturity);

    const harvestEnd = new Date(harvestStart);
    harvestEnd.setDate(harvestEnd.getDate() + 30);

    setForm({
      ...form,
      crop_name: item.name,
      category: item.category === "flowers" ? "flowers" :
                item.category === "micros_leaves" ? "micro" :
                item.category === "herbs_leaves" ? "herbs" :
                item.category === "fruit_veg" ? "fruit" : "other",
      harvest_unit: item.unit_type,
      avg_price: item.default_price ? String(item.default_price) : "",
      harvest_start: harvestStart.toISOString().split("T")[0],
      harvest_end: harvestEnd.toISOString().split("T")[0],
    });
    setStep("details");
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Auto-calc harvest dates when sow/maturity changes
  function updateDates(sowDate: string, maturityDays: string) {
    const mat = parseInt(maturityDays) || 30;
    const hs = new Date(sowDate + "T12:00:00");
    hs.setDate(hs.getDate() + mat);
    const he = new Date(hs);
    he.setDate(he.getDate() + 30);
    setForm((f) => ({
      ...f,
      sow_date: sowDate,
      days_to_maturity: maturityDays,
      harvest_start: hs.toISOString().split("T")[0],
      harvest_end: he.toISOString().split("T")[0],
    }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/plantings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: farmId,
        item_id: selectedItem?.id ?? null,
        crop_name: form.crop_name,
        variety: form.variety || null,
        category: form.category,
        growing_location: form.growing_location,
        planting_stock: form.planting_stock,
        sow_date: form.sow_date || null,
        days_to_maturity: form.days_to_maturity ? parseInt(form.days_to_maturity) : null,
        harvest_start: form.harvest_start || null,
        harvest_end: form.harvest_end || null,
        location: form.location || null,
        quantity: form.quantity ? parseInt(form.quantity) : null,
        quantity_unit: form.quantity_unit,
        harvest_unit: form.harvest_unit,
        avg_price: form.avg_price ? parseFloat(form.avg_price) : null,
        projected_revenue: form.avg_price && form.quantity ? parseFloat(form.avg_price) * parseInt(form.quantity) : null,
        notes: form.notes || null,
        status: form.status,
        season,
      }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  const filteredItems = items.filter((i) =>
    !searchItems || i.name.toLowerCase().includes(searchItems.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base text-farm-dark">
              {step === "crop" ? "Select Crop" : `New Planting: ${form.crop_name}`}
            </h3>
            {step === "details" && selectedItem?.image_url && (
              <div className="flex items-center gap-2 mt-1">
                <img src={selectedItem.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                <span className="text-xs text-gray-400">{form.category}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 min-h-0 min-w-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Crop picker */}
        {step === "crop" && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" placeholder="Search your items..."
                  value={searchItems} onChange={(e) => setSearchItems(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
            <div className="px-4 pb-4 space-y-1 max-h-[50vh] overflow-y-auto">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectCrop(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left min-h-0"
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Sprout className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-farm-dark truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.category} · {item.unit_type.toUpperCase()}{item.default_price ? ` · $${item.default_price}` : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Planting details */}
        {step === "details" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Dates section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Planting Timeline</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sow Date</label>
                  <input type="date" value={form.sow_date}
                    onChange={(e) => updateDates(e.target.value, form.days_to_maturity)}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Days to Maturity</label>
                  <input type="number" value={form.days_to_maturity}
                    onChange={(e) => updateDates(form.sow_date, e.target.value)}
                    className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Harvest Start</label>
                  <input type="date" value={form.harvest_start} onChange={(e) => set("harvest_start", e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Harvest End</label>
                  <input type="date" value={form.harvest_end} onChange={(e) => set("harvest_end", e.target.value)} className="input-field" />
                </div>
              </div>

              {/* Visual timeline bar */}
              {form.sow_date && form.harvest_end && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1 text-[9px] text-gray-400 mb-1">
                    <span>Sow {fmtDate(form.sow_date)}</span>
                    <span className="flex-1 text-center">→ {form.days_to_maturity}d →</span>
                    <span>Harvest {fmtDate(form.harvest_start)} – {fmtDate(form.harvest_end)}</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
                    <div className="h-full rounded-l-full opacity-50" style={{
                      backgroundColor: CAT_COLORS[form.category] ?? "#6b7280",
                      width: "40%",
                    }} />
                    <div className="h-full rounded-r-full" style={{
                      backgroundColor: CAT_COLORS[form.category] ?? "#6b7280",
                      width: "60%",
                    }} />
                  </div>
                  <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                    <span>Growing</span>
                    <span>Harvest Window</span>
                  </div>
                </div>
              )}
            </div>

            {/* Growing info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Growing Info</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Variety</label>
                  <input type="text" value={form.variety} onChange={(e) => set("variety", e.target.value)} placeholder="Optional" className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                  <select value={form.location} onChange={(e) => set("location", e.target.value)} className="input-field">
                    <option value="">Select...</option>
                    {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Growing</label>
                  <select value={form.growing_location} onChange={(e) => set("growing_location", e.target.value)} className="input-field">
                    <option value="in_ground">In Ground</option>
                    <option value="in_containers">In Containers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
                  <select value={form.planting_stock} onChange={(e) => set("planting_stock", e.target.value)} className="input-field">
                    <option value="seeds">Seeds</option>
                    <option value="plugs">Plugs</option>
                    <option value="transplants">Transplants</option>
                    <option value="cuttings">Cuttings</option>
                    <option value="bulbs">Bulbs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => set("status", e.target.value)} className="input-field">
                    <option value="planned">Planned</option>
                    <option value="planted">Planted</option>
                    <option value="growing">Growing</option>
                    <option value="harvesting">Harvesting</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quantity & Revenue */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount & Revenue</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                  <input type="number" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="0" className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                  <select value={form.quantity_unit} onChange={(e) => set("quantity_unit", e.target.value)} className="input-field">
                    <option value="plants">Plants</option>
                    <option value="containers">Containers</option>
                    <option value="beds">Beds</option>
                    <option value="sq_ft">Sq. Ft.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Avg Price</label>
                  <input type="number" step="0.01" value={form.avg_price} onChange={(e) => set("avg_price", e.target.value)} placeholder="$0" className="input-field" />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Optional notes..." className="input-field resize-none" />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          {step === "details" && (
            <button onClick={() => setStep("crop")} className="btn-ghost flex-1">Back</button>
          )}
          {step === "details" && (
            <button onClick={handleSave} disabled={saving || !form.crop_name} className="btn-primary flex-[2]">
              {saving ? "Creating..." : "Create Planting"}
            </button>
          )}
          {step === "crop" && (
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Planting Detail Panel ──
function PlantingDetail({ planting, onClose, onDeleted, onUpdated }: {
  planting: Planting;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete planting "${planting.crop_name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/plantings/${planting.id}`, { method: "DELETE" });
    onDeleted();
  }

  async function updateStatus(status: string) {
    await fetch(`/api/plantings/${planting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onUpdated();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base text-farm-dark">{planting.crop_name}</h3>
            {planting.variety && <p className="text-xs text-gray-400">{planting.variety}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 min-h-0 min-w-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={STATUS_COLORS[planting.status] ?? "badge-gray"}>{planting.status}</span>
            <div className="flex gap-1 ml-auto">
              {["planned", "planted", "growing", "harvesting", "terminated"].map((s) => (
                <button key={s} onClick={() => updateStatus(s)}
                  className={`text-[9px] px-2 py-0.5 rounded-full min-h-0 min-w-0 capitalize ${planting.status === s ? "bg-farm-green text-white" : "bg-gray-100 text-gray-400"}`}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-3 space-y-2">
            <h4 className="text-xs font-semibold text-gray-500">Timeline</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-400">Sow:</span> <span className="font-medium">{fmtDate(planting.sow_date)}</span></div>
              <div><span className="text-gray-400">Maturity:</span> <span className="font-medium">{planting.days_to_maturity ?? "—"}d</span></div>
              <div><span className="text-gray-400">Harvest Start:</span> <span className="font-medium">{fmtDate(planting.harvest_start)}</span></div>
              <div><span className="text-gray-400">Harvest End:</span> <span className="font-medium">{fmtDate(planting.harvest_end)}</span></div>
            </div>
          </div>

          {/* Details */}
          <div className="card p-3 space-y-2">
            <h4 className="text-xs font-semibold text-gray-500">Details</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-400">Category:</span> <span className="font-medium capitalize">{planting.category ?? "—"}</span></div>
              <div><span className="text-gray-400">Location:</span> <span className="font-medium">{planting.location ?? "—"}</span></div>
              <div><span className="text-gray-400">Growing:</span> <span className="font-medium capitalize">{planting.growing_location?.replace("_", " ") ?? "—"}</span></div>
              <div><span className="text-gray-400">Stock:</span> <span className="font-medium capitalize">{planting.planting_stock ?? "—"}</span></div>
              <div><span className="text-gray-400">Quantity:</span> <span className="font-medium">{planting.quantity ?? "—"} {planting.quantity_unit ?? ""}</span></div>
              <div><span className="text-gray-400">Avg Price:</span> <span className="font-medium">{planting.avg_price ? `$${planting.avg_price}` : "—"}</span></div>
            </div>
          </div>

          {/* Notes */}
          {planting.notes && (
            <div className="card p-3">
              <h4 className="text-xs font-semibold text-gray-500 mb-1">Notes</h4>
              <p className="text-xs text-gray-700">{planting.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 min-h-0 px-3 py-2">
            <Trash2 className="w-3.5 h-3.5" /> {deleting ? "..." : "Delete"}
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}
