"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/constants";
import type { ItemCategory } from "@/types";

interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  unit_type: string;
  default_price: number | null;
  is_archived: boolean;
  chef_notes: string | null;
  image_url: string | null;
}

interface Props {
  items: Item[];
}

export function ItemsClient({ items }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
            showArchived
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-500 border-gray-200"
          }`}
        >
          Archived
        </button>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">
        {filtered.length} {filtered.length === 1 ? "item" : "items"}
      </p>

      {/* Grouped list */}
      {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
        <div key={cat}>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[cat]} ({grouped[cat].length})
          </h2>
          <div className="space-y-1">
            {grouped[cat].map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border flex items-center gap-3 pr-2 transition-colors ${
                  item.is_archived ? "border-gray-100 opacity-50" : "border-gray-100"
                }`}
              >
                <div className="flex-1 px-3 py-3 min-h-[48px]">
                  <div className="flex items-center gap-3">
                    {/* Photo thumbnail */}
                    <Link href={`/admin/items/${item.id}`} className="flex-shrink-0 min-h-0 min-w-0">
                      {item.image_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="text-gray-300 text-lg">🌿</span>
                        </div>
                      )}
                    </Link>
                    <Link href={`/admin/items/${item.id}`} className="flex-1 min-w-0 min-h-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.unit_type.toUpperCase()}
                        {item.default_price != null && ` · $${item.default_price.toFixed(2)}`}
                        {item.is_archived && " · Archived"}
                      </p>
                    </Link>
                    <Link href={`/admin/items/${item.id}`} className="min-h-0 min-w-0">
                      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className="text-xs text-gray-400 min-h-0 min-w-0 px-1"
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
                        <span className="text-blue-600 italic">{item.chef_notes}</span>
                      ) : (
                        <span className="text-gray-300 hover:text-gray-500">+ Add chef note</span>
                      )}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => toggleArchive(item)}
                  disabled={archiving === item.id}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-300 hover:text-gray-600 disabled:opacity-50 transition-colors"
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
        <p className="text-center text-sm text-gray-400 py-8">
          {search ? "No items match your search." : "No items in catalog yet."}
        </p>
      )}
    </div>
  );
}
