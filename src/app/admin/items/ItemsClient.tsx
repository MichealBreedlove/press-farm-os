"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/constants";
import { getItemImageUrl } from "@/lib/flower-images";
import type { ItemCategory } from "@/types";

interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  unit_type: string;
  default_price: number | null;
  unit_prices?: Record<string, number> | null;
  is_archived: boolean;
  is_event_item?: boolean;
  chef_notes: string | null;
  image_url: string | null;
}

interface Props {
  items: Item[];
  addItemHref?: string;
}

export function ItemsClient({ items, addItemHref }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | "archive" | "unarchive">(null);

  function startEditNote(item: Item) {
    setEditingNote(item.id);
    setNoteValue(item.chef_notes ?? "");
  }

  async function saveNote(itemId: string) {
    setSavingNote(itemId);
    try {
      await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chef_notes: noteValue || null }),
      });
      router.refresh();
    } finally {
      setSavingNote(null);
      setEditingNote(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      if (!showArchived && item.is_archived) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, showArchived]);

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of filtered) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [filtered]);

  async function toggleArchive(item: Item) {
    setArchiving(item.id);
    try {
      await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: !item.is_archived }),
      });
      router.refresh();
    } finally {
      setArchiving(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((i) => i.id)));
  }

  async function runBulk(action: "archive" | "unarchive") {
    if (selected.size === 0) return;
    setBulkBusy(action);
    try {
      const res = await fetch("/api/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Bulk update failed" }));
        alert(error || "Bulk update failed");
        return;
      }
      exitSelectionMode();
      router.refresh();
    } finally {
      setBulkBusy(null);
    }
  }

  // Counts of currently-visible items in each archive state — drives which bulk
  // actions we even offer (don't show "Archive" if everything selected is already archived).
  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected],
  );
  const selectedActiveCount = selectedItems.filter((i) => !i.is_archived).length;
  const selectedArchivedCount = selectedItems.length - selectedActiveCount;

  return (
    <div className="space-y-4 pb-20">
      {/* Search + filters */}
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-farm-dark/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green/30 focus:border-farm-green"
        />
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors min-h-0 ${
            showArchived
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-farm-muted border-farm-dark/10 hover:border-farm-dark/15"
          }`}
        >
          Archived
        </button>
        <button
          onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
          className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors min-h-0 ${
            selectionMode
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-farm-muted border-farm-dark/10 hover:border-farm-dark/15"
          }`}
        >
          {selectionMode ? "Done" : "Select"}
        </button>
        {addItemHref && !selectionMode && (
          <Link
            href={addItemHref}
            className="px-4 py-2.5 rounded-xl bg-farm-green text-white text-sm font-medium hover:bg-farm-green-dark transition-colors min-h-0 flex items-center gap-1 whitespace-nowrap"
          >
            <span className="text-base leading-none">+</span>
            <span>Add</span>
          </Link>
        )}
      </div>

      {/* Count + Import/Export shortcut — or selection controls */}
      {selectionMode ? (
        <div className="flex items-center justify-between text-xs text-farm-muted">
          <p>
            {selected.size} selected · {filtered.length} visible
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={selectAllVisible}
              disabled={filtered.length === 0 || selected.size === filtered.length}
              className="text-xs text-farm-green font-medium hover:underline min-h-0 disabled:opacity-40 disabled:no-underline"
            >
              Select all visible
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
              className="text-xs text-farm-muted font-medium hover:underline min-h-0 disabled:opacity-40 disabled:no-underline"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-farm-muted">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </p>
          <Link
            href="/admin/items/data"
            className="text-xs text-farm-green font-medium hover:underline inline-flex items-center gap-1 min-h-0"
            title="Bulk import / export"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Import / Export
          </Link>
        </div>
      )}
      {/* When searching, show flat list. Otherwise, group by category. */}
      {(search.trim()
        ? [{ key: "search", items: filtered, label: `Search Results (${filtered.length})` }]
        : CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => ({
            key: cat as string,
            items: grouped[cat],
            label: `${CATEGORY_LABELS[cat]} (${grouped[cat].length})`,
          }))
      ).map(({ key, items: catItems, label }) => (
        <div key={key}>
          <p className="section-eyebrow with-flower text-farm-muted mb-2">{label}</p>
          <div className="space-y-1">
            {catItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border flex items-center gap-3 pr-2 transition-colors ${
                  item.is_archived ? "border-farm-dark/5 opacity-50" : "border-farm-dark/5"
                }`}
              >
                <div className="flex-1 px-3 py-3 min-h-[48px]">
                  <div className="flex items-center gap-3">
                    {/* Photo thumbnail — admin photo, then flower fallback, then placeholder */}
                    <Link href={`/admin/items/${item.id}`} className="flex-shrink-0 min-h-0 min-w-0">
                      {(() => {
                        const imgUrl = getItemImageUrl(item);
                        const isFlower = imgUrl?.startsWith("/assets/pressfarm/flowers/");
                        if (imgUrl) {
                          return (
                            <div className={`w-20 h-20 rounded-lg overflow-hidden ${isFlower ? "bg-farm-cream" : "bg-farm-cream/60"}`}>
                              <img
                                src={imgUrl}
                                alt={item.name}
                                className={`w-full h-full ${isFlower ? "object-contain p-1" : "object-cover"}`}
                                loading="lazy"
                              />
                            </div>
                          );
                        }
                        return (
                          <div className="w-20 h-20 rounded-lg bg-farm-cream/60 border border-farm-dark/5 flex items-center justify-center">
                            <img
                              src="/assets/logo/png/logo-floral-only-transparent.png"
                              alt=""
                              aria-hidden="true"
                              className="w-12 h-12 object-contain opacity-25"
                            />
                          </div>
                        );
                      })()}
                    </Link>
                    <Link href={`/admin/items/${item.id}`} className="flex-1 min-w-0 min-h-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-farm-dark truncate">{item.name}</p>
                        {item.is_event_item && (
                          <span className="text-[9px] tracking-wider uppercase bg-pf-master-violet/10 text-pf-master-violet px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                            Event
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-farm-muted mt-0.5">
                        {(() => {
                          const units = item.unit_type.split(",").map((u) => u.trim()).filter(Boolean);
                          const map = item.unit_prices ?? {};
                          // If any per-unit price exists, render "SM $15 · LG $30"
                          const hasPerUnit = units.some((u) => typeof map[u] === "number");
                          if (hasPerUnit) {
                            const parts = units.map((u) => {
                              const p = typeof map[u] === "number" ? map[u] : item.default_price;
                              return p != null ? `${u.toUpperCase()} $${p.toFixed(2)}` : u.toUpperCase();
                            });
                            return parts.join(" · ");
                          }
                          // Fallback: just unit codes + default_price (legacy)
                          const unitsStr = units.map((u) => u.toUpperCase()).join(" · ");
                          return item.default_price != null
                            ? `${unitsStr} · $${item.default_price.toFixed(2)}`
                            : unitsStr;
                        })()}
                        {item.is_archived && " · Archived"}
                      </p>
                    </Link>
                    <Link href={`/admin/items/${item.id}`} className="min-h-0 min-w-0">
                      <svg className="w-4 h-4 text-farm-muted/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                  {/* Inline chef notes */}
                  {editingNote === item.id ? (
                    <div className="mt-1.5 flex gap-1.5">
                      <input
                        type="text"
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveNote(item.id); if (e.key === "Escape") setEditingNote(null); }}
                        placeholder="Chef note..."
                        autoFocus
                        className="flex-1 text-xs border border-farm-green rounded-lg px-2 py-1.5 min-h-0 focus:outline-none focus:ring-1 focus:ring-farm-green"
                      />
                      <button
                        onClick={() => saveNote(item.id)}
                        disabled={savingNote === item.id}
                        className="text-xs text-white bg-farm-green rounded-lg px-2.5 py-1.5 min-h-0 min-w-0 font-medium disabled:opacity-50"
                      >
                        {savingNote === item.id ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingNote(null)}
                        className="text-xs text-farm-muted min-h-0 min-w-0 px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditNote(item)}
                      className="mt-1 text-xs min-h-0 min-w-0 text-left w-full truncate transition-colors"
                    >
                      {item.chef_notes ? (
                        <span className="text-farm-green italic">{item.chef_notes}</span>
                      ) : (
                        <span className="text-farm-muted/60 hover:text-farm-muted">+ Add chef note</span>
                      )}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => toggleArchive(item)}
                  disabled={archiving === item.id}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center text-farm-muted/60 hover:text-farm-muted/90 disabled:opacity-50 transition-colors"
                  title={item.is_archived ? "Unarchive" : "Archive"}
                >
                  {archiving === item.id ? (
                    <span className="text-xs">…</span>
                  ) : item.is_archived ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        search ? (
          <p className="text-center text-sm text-farm-muted py-8">
            No items match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          <div className="text-center py-10">
            <img src="/assets/pressfarm/flowers/nasturtium.png" alt="" aria-hidden="true" className="mx-auto h-24 w-auto mb-4" />
            <h3 className="text-base font-semibold text-farm-dark">Your item catalog is empty</h3>
            <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">
              Add the produce you grow so chefs can order it. Start with one or import in bulk via Settings.
            </p>
          </div>
        )
      )}
    </div>
  );
}
