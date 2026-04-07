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
}

interface Props {
  items: Item[];
}

export function ItemsClient({ items }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

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
                <Link
                  href={`/admin/items/${item.id}`}
                  className="flex-1 flex items-center gap-3 px-4 py-3 min-h-[48px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.unit_type.toUpperCase()}
                      {item.default_price != null && ` · $${item.default_price.toFixed(2)}`}
                      {item.is_archived && " · Archived"}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
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
