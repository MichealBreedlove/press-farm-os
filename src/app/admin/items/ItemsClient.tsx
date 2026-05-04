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
  is_press_bar_item?: boolean;
  chef_notes: string | null;
  image_url: string | null;
  parent_item_id?: string | null;
}

interface Props {
  items: Item[];
  /** Map of item id → name so children can render a "↳ part of <Parent>" label. */
  parentNames?: Record<string, string>;
  addItemHref?: string;
}

export function ItemsClient({ items, parentNames, addItemHref }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | "archive" | "unarchive" | "delete">(null);
  // Confirmation gate for the destructive Delete action
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Result panel after a delete attempt — shows what couldn't be deleted
  // and offers a one-click "archive those instead" fallback.
  const [deleteResult, setDeleteResult] = useState<null | {
    deleted: number;
    failed: { id: string; name: string; reason: string }[];
  }>(null);

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
    // Top-level item ids that ARE visible — used to decide whether a
    // child should render nested (parent visible) or fall back to its
    // own category section (parent filtered out).
    const visibleParentIds = new Set(
      filtered.filter((i) => !i.parent_item_id).map((i) => i.id),
    );
    for (const item of filtered) {
      // When searching, treat every match as a top-level entry — chefs
      // looking for "blossom" want a flat results list, not nested
      // matches buried under their parent.
      if (!search.trim() && item.parent_item_id && visibleParentIds.has(item.parent_item_id)) {
        continue;
      }
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [filtered, search]);

  // Children grouped by their visible parent — used to render the
  // nested rows directly under each parent in the category sections.
  const childrenByParent = useMemo(() => {
    if (search.trim()) return {} as Record<string, Item[]>;
    const map: Record<string, Item[]> = {};
    for (const item of filtered) {
      if (!item.parent_item_id) continue;
      if (!map[item.parent_item_id]) map[item.parent_item_id] = [];
      map[item.parent_item_id].push(item);
    }
    return map;
  }, [filtered, search]);

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

  async function runBulk(action: "archive" | "unarchive" | "delete") {
    if (selected.size === 0) return;
    setBulkBusy(action);
    try {
      const idsBeingActedOn = Array.from(selected);
      const res = await fetch("/api/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsBeingActedOn, action }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Bulk action failed" }));
        alert(error || "Bulk action failed");
        return;
      }

      // Delete returns per-item failures; show the result so admin can
      // archive the ones that couldn't be hard-deleted.
      if (action === "delete") {
        const json = await res.json().catch(() => ({}));
        setDeleteResult({
          deleted: json.deleted ?? 0,
          failed: Array.isArray(json.failed) ? json.failed : [],
        });
        // Keep selection on the failed ones so the "archive instead"
        // button can act on them directly without re-selecting
        const failedIds = new Set<string>(
          (json.failed ?? []).map((f: any) => f.id),
        );
        setSelected(failedIds);
        if (failedIds.size === 0) exitSelectionMode();
        router.refresh();
        return;
      }

      exitSelectionMode();
      router.refresh();
    } finally {
      setBulkBusy(null);
      setConfirmDelete(false);
    }
  }

  // Convert any current "failed delete" items to archived in one click.
  // Reuses runBulk() so the same loading state + refresh logic applies.
  async function archiveFailedDeletes() {
    if (!deleteResult || deleteResult.failed.length === 0) return;
    const ids = deleteResult.failed.map((f) => f.id);
    setSelected(new Set(ids));
    setDeleteResult(null);
    await runBulk("archive");
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-farm-muted">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </p>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/admin/items/audit"
              className="text-xs text-pf-master-violet font-medium hover:underline inline-flex items-center gap-1 min-h-0"
              title="AI catalog audit — duplicates + parent/child suggestions"
            >
              <span aria-hidden="true">✨</span>
              Audit
            </Link>
            <Link
              href="/admin/items/bulk-fill"
              className="text-xs text-pf-master-violet font-medium hover:underline inline-flex items-center gap-1 min-h-0"
              title="AI bulk fill — runs the suggester on every item with empty fields"
            >
              <span aria-hidden="true">✨</span>
              Bulk Fill
            </Link>
            <Link
              href="/admin/items/photos"
              className="text-xs text-farm-green font-medium hover:underline inline-flex items-center gap-1 min-h-0"
              title="Bulk upload / delete catalog photos"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Photos
            </Link>
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
        </div>
      )}
      {/* When searching, show flat list. Otherwise, group by category. */}
      {(() => {
        // Render one item card. Used for both top-level rows and the
        // nested children rendered under their parent. Pulled out to
        // avoid duplicating the 100+ lines of card markup.
        const renderItemCard = (item: Item, isNested: boolean) => (
          <div
            key={item.id}
            className={`bg-white rounded-xl border flex items-center gap-3 pr-2 transition-colors ${
              item.is_archived ? "border-farm-dark/5 opacity-50" : "border-farm-dark/5"
            }`}
          >
            <div className="flex-1 px-3 py-3 min-h-[48px]">
              <div className="flex items-center gap-3">
                <Link href={`/admin/items/${item.id}`} className="flex-shrink-0 min-h-0 min-w-0">
                  {(() => {
                    const imgUrl = getItemImageUrl(item);
                    const isFlower = imgUrl?.startsWith("/assets/pressfarm/flowers/");
                    // Children render at a slightly smaller thumbnail so
                    // the visual hierarchy reads at a glance.
                    const sizeClass = isNested ? "w-14 h-14" : "w-20 h-20";
                    const innerSize = isNested ? "w-9 h-9" : "w-12 h-12";
                    if (imgUrl) {
                      return (
                        <div className={`${sizeClass} rounded-lg overflow-hidden ${isFlower ? "bg-farm-cream" : "bg-farm-cream/60"}`}>
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
                      <div className={`${sizeClass} rounded-lg bg-farm-cream/60 border border-farm-dark/5 flex items-center justify-center`}>
                        <img
                          src="/assets/logo/png/logo-floral-only-transparent.png"
                          alt=""
                          aria-hidden="true"
                          className={`${innerSize} object-contain opacity-25`}
                        />
                      </div>
                    );
                  })()}
                </Link>
                <Link href={`/admin/items/${item.id}`} className="flex-1 min-w-0 min-h-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-farm-dark truncate">{item.name}</p>
                    {/* Category pill — shown when searching (flat list
                        loses category context) AND when nested (the
                        child is sitting in the parent's category section,
                        so its real category is otherwise invisible). */}
                    {(search.trim() || isNested) && (
                      <span className="text-[9px] tracking-wider uppercase bg-farm-cream/80 text-farm-muted px-1.5 py-0.5 rounded font-semibold flex-shrink-0 border border-farm-dark/5">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                    )}
                    {item.is_event_item && (
                      <span className="text-[9px] tracking-wider uppercase bg-pf-master-violet/10 text-pf-master-violet px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                        Event
                      </span>
                    )}
                    {item.is_press_bar_item && (
                      <span className="text-[9px] tracking-wider uppercase bg-pf-master-blue/10 text-pf-master-blue px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                        Press Bar
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-farm-muted mt-0.5">
                    {(() => {
                      const units = item.unit_type.split(",").map((u) => u.trim()).filter(Boolean);
                      const map = item.unit_prices ?? {};
                      const hasPerUnit = units.some((u) => typeof map[u] === "number");
                      if (hasPerUnit) {
                        const parts = units.map((u) => {
                          const p = typeof map[u] === "number" ? map[u] : item.default_price;
                          return p != null ? `${u.toUpperCase()} $${p.toFixed(2)}` : u.toUpperCase();
                        });
                        return parts.join(" · ");
                      }
                      const unitsStr = units.map((u) => u.toUpperCase()).join(" · ");
                      return item.default_price != null
                        ? `${unitsStr} · $${item.default_price.toFixed(2)}`
                        : unitsStr;
                    })()}
                    {item.is_archived && " · Archived"}
                  </p>
                  {/* "↳ part of …" label — only shown when the child is
                      rendering at top level (its parent was filtered out
                      or this is search). When nested directly under the
                      parent the indent + guide line make the relationship
                      obvious so the label would just be noise. */}
                  {!isNested && item.parent_item_id && parentNames?.[item.parent_item_id] && (
                    <p className="text-[10px] text-farm-muted/70 mt-0.5 italic">
                      ↳ part of {parentNames[item.parent_item_id]}
                    </p>
                  )}
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
        );

        const sections = search.trim()
          ? [{ key: "search", items: filtered, label: `Search Results (${filtered.length})` }]
          : CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => ({
              key: cat as string,
              items: grouped[cat],
              label: `${CATEGORY_LABELS[cat]} (${grouped[cat].length})`,
            }));

        return sections.map(({ key, items: catItems, label }) => (
          <div key={key}>
            <p className="section-eyebrow with-flower text-farm-muted mb-2">{label}</p>
            <div className="space-y-1">
              {catItems.map((item) => {
                const kids = childrenByParent[item.id] ?? [];
                if (kids.length === 0) return renderItemCard(item, false);
                return (
                  <div key={item.id} className="space-y-1">
                    {renderItemCard(item, false)}
                    <div className="ml-6 space-y-1 border-l-2 border-farm-green/20 pl-3">
                      {kids.map((child) => renderItemCard(child, true))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ));
      })()}

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

      {/* Sticky bulk-action bar — sits above the admin bottom nav and only
          appears when at least one item is selected. Archive is the safe
          default; Delete is destructive and gated by a typed confirmation. */}
      {selectionMode && selected.size > 0 && (
        <div
          className="fixed inset-x-0 bottom-nav-safe bg-white border-t border-farm-dark/10 px-4 py-3 z-40"
          style={{ boxShadow: "0 -8px 16px -8px rgba(0, 0, 0, 0.08)" }}
        >
          <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
            <p className="text-xs text-farm-muted flex-shrink-0">
              {selected.size} selected
            </p>
            <div className="flex-1" />
            {selectedActiveCount > 0 && (
              <button
                type="button"
                onClick={() => runBulk("archive")}
                disabled={bulkBusy !== null}
                className="px-3 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-dark bg-white hover:bg-farm-cream/40 disabled:opacity-50"
              >
                {bulkBusy === "archive" ? "Archiving…" : `Archive ${selectedActiveCount}`}
              </button>
            )}
            {selectedArchivedCount > 0 && (
              <button
                type="button"
                onClick={() => runBulk("unarchive")}
                disabled={bulkBusy !== null}
                className="px-3 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-dark bg-white hover:bg-farm-cream/40 disabled:opacity-50"
              >
                {bulkBusy === "unarchive" ? "Unarchiving…" : `Unarchive ${selectedArchivedCount}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={bulkBusy !== null}
              className="px-3 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {bulkBusy === "delete" ? "Deleting…" : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal — explains the cascade risk before
          we attempt the destructive action. Items referenced by past
          orders or saved prices will fail; items referenced only by
          delivery history will succeed and take that history with them. */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-farm-dark/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6">
            <p className="text-[10px] tracking-[0.18em] uppercase text-red-600 font-semibold">
              Permanent delete
            </p>
            <h2 className="font-display text-xl text-farm-dark mt-1">
              Delete {selected.size} item{selected.size === 1 ? "" : "s"}?
            </h2>
            <div className="mt-3 space-y-2 text-sm text-farm-dark/85 leading-relaxed">
              <p>
                Items <strong>not referenced</strong> by any past orders or saved prices will be removed from the database, along with their availability rows, price history, and{" "}
                <strong className="text-red-700">delivery history</strong>.
              </p>
              <p>
                Items referenced by past orders or saved prices <strong>cannot</strong> be hard-deleted — you&apos;ll see a list of those after, with a one-click option to archive them instead.
              </p>
              <p className="text-farm-muted text-xs">
                Tip: archive is the safer default. It hides the item from chef order forms while preserving every record.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={bulkBusy === "delete"}
                className="px-4 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runBulk("delete")}
                disabled={bulkBusy === "delete"}
                className="px-4 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {bulkBusy === "delete" ? "Deleting…" : `Delete ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-delete result modal — shows what couldn't be deleted and
          offers the archive fallback for those rows in one click. */}
      {deleteResult && (
        <div className="fixed inset-0 z-[60] bg-farm-dark/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-farm-dark/5 flex-shrink-0">
              <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green font-semibold">
                Delete results
              </p>
              <h2 className="font-display text-xl text-farm-dark mt-1">
                {deleteResult.deleted} deleted
                {deleteResult.failed.length > 0 && ` · ${deleteResult.failed.length} kept`}
              </h2>
            </div>
            {deleteResult.failed.length > 0 && (
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
                <p className="text-sm text-farm-dark/85 leading-relaxed mb-3">
                  These items couldn&apos;t be hard-deleted because they&apos;re tied to existing records:
                </p>
                <ul className="space-y-1 text-xs">
                  {deleteResult.failed.slice(0, 30).map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded bg-farm-cream/40">
                      <span className="font-medium text-farm-dark truncate">{f.name}</span>
                      <span className="text-farm-muted flex-shrink-0">{f.reason}</span>
                    </li>
                  ))}
                  {deleteResult.failed.length > 30 && (
                    <li className="text-farm-muted px-2 pt-1">
                      + {deleteResult.failed.length - 30} more
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="px-5 sm:px-6 py-3 border-t border-farm-dark/5 flex-shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteResult(null); exitSelectionMode(); }}
                className="px-4 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40"
              >
                Done
              </button>
              {deleteResult.failed.length > 0 && (
                <button
                  type="button"
                  onClick={archiveFailedDeletes}
                  disabled={bulkBusy !== null}
                  className="px-4 min-h-[40px] rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-dark disabled:opacity-50"
                >
                  Archive {deleteResult.failed.length} instead
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
