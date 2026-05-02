"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, Check, Loader2, AlertTriangle } from "lucide-react";

interface Proposal {
  itemId: string;
  itemName: string;
  currentUrl: string | null;
  photoPath: string;
  photoName: string;
  photoUrl: string;
  confidence: number;
  tier: "high" | "medium" | "low";
}

interface Summary {
  itemsConsidered: number;
  photosAvailable: number;
  proposed: number;
  highConfidence: number;
  mediumConfidence: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApplied: (count: number) => void;
}

/**
 * MatchPhotosDialog — full-screen modal that proposes photo→item matches
 * by name similarity and lets admin review/uncheck before applying in bulk.
 *
 * Workflow:
 *   1. Opens → fetches GET /api/items/match-photos?scope=missing
 *   2. Shows proposals grouped by confidence tier; high-tier ones are
 *      pre-selected, medium-tier ones are not (admin opts in)
 *   3. Admin tweaks selection → "Apply N matches" → POST with the
 *      selected pairs → endpoint UPDATEs items.image_url
 *
 * Scope toggle ("Items missing photos" vs "All items") swaps the GET
 * param. The all-items mode is for cases where existing assignments are
 * wrong and admin wants the matcher to overwrite them.
 */
export function MatchPhotosDialog({ open, onClose, onApplied }: Props) {
  const [scope, setScope] = useState<"missing" | "all">("missing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ applied: number; errors: number } | null>(null);

  async function load(scopeToUse: "missing" | "all") {
    setLoading(true);
    setError(null);
    setApplyResult(null);
    try {
      const res = await fetch(`/api/items/match-photos?scope=${scopeToUse}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to compute matches");
      const props = (json.proposals ?? []) as Proposal[];
      setProposals(props);
      setSummary(json.summary ?? null);
      // Pre-select high-confidence matches; admin opts into medium tier
      const preSelected = new Set(props.filter((p) => p.tier === "high").map((p) => p.itemId));
      setSelected(preSelected);
    } catch (err: any) {
      setError(err?.message ?? "Failed to compute matches");
      setProposals([]);
      setSummary(null);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  // Re-fetch when modal opens or scope changes
  useEffect(() => {
    if (open) load(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope]);

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll(filterTier?: "high" | "medium" | "low") {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of proposals) {
        if (!filterTier || p.tier === filterTier) next.add(p.itemId);
      }
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function apply() {
    const list = proposals
      .filter((p) => selected.has(p.itemId))
      .map((p) => ({ itemId: p.itemId, photoUrl: p.photoUrl }));
    if (list.length === 0) return;

    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/items/match-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: list }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to apply matches");
      setApplyResult({ applied: json.applied ?? 0, errors: (json.errors ?? []).length });
      onApplied(json.applied ?? 0);
      // Re-load to reflect new state — items that just got a photo move
      // out of "missing" scope, and the proposal list shrinks
      await load(scope);
    } catch (err: any) {
      setError(err?.message ?? "Failed to apply matches");
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  const grouped = {
    high: proposals.filter((p) => p.tier === "high"),
    medium: proposals.filter((p) => p.tier === "medium"),
    low: proposals.filter((p) => p.tier === "low"),
  };

  return (
    <div className="fixed inset-0 z-[70] bg-farm-dark/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-farm-dark/5 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-farm-green/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-farm-green" />
            </div>
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">
                Auto-match
              </p>
              <h2 className="font-display text-xl text-farm-dark mt-0.5">
                Match Photos to Items
              </h2>
              <p className="text-xs text-farm-muted mt-0.5">
                Suggested by name similarity — review before applying.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted hover:text-farm-dark p-1 min-h-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope tabs */}
        <div className="px-4 sm:px-6 py-3 border-b border-farm-dark/5 flex-shrink-0 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-farm-dark/10 p-0.5 bg-farm-cream/40">
            <button
              type="button"
              onClick={() => setScope("missing")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-0 ${
                scope === "missing"
                  ? "bg-white text-farm-dark shadow-sm"
                  : "text-farm-muted hover:text-farm-dark"
              }`}
            >
              Items missing photos
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-0 ${
                scope === "all"
                  ? "bg-white text-farm-dark shadow-sm"
                  : "text-farm-muted hover:text-farm-dark"
              }`}
            >
              All items (overwrite)
            </button>
          </div>
          {summary && (
            <p className="text-xs text-farm-muted ml-auto">
              {summary.itemsConsidered} items · {summary.photosAvailable} photos · {summary.proposed} proposed
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {loading ? (
            <div className="py-16 text-center text-farm-muted text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Computing matches…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-farm-dark">No matches found.</p>
              <p className="text-xs text-farm-muted mt-1">
                {scope === "missing"
                  ? "Either every item already has a photo, or no photo names look similar enough."
                  : "No photo names look similar enough to any item."}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* High confidence */}
              {grouped.high.length > 0 && (
                <Section
                  label="High confidence"
                  count={grouped.high.length}
                  description="Names line up cleanly. Pre-selected — uncheck any you want to skip."
                  proposals={grouped.high}
                  selected={selected}
                  onToggle={toggle}
                  onSelectAll={() => selectAll("high")}
                />
              )}
              {/* Medium confidence */}
              {grouped.medium.length > 0 && (
                <Section
                  label="Medium confidence"
                  count={grouped.medium.length}
                  description="Plausible matches. Review each before applying."
                  proposals={grouped.medium}
                  selected={selected}
                  onToggle={toggle}
                  onSelectAll={() => selectAll("medium")}
                  warn
                />
              )}
            </div>
          )}

          {applyResult && (
            <div className="mt-4 rounded-xl border border-farm-green/30 bg-farm-green/5 px-4 py-3 text-sm text-farm-dark">
              <span className="font-semibold text-farm-green">Applied.</span>{" "}
              {applyResult.applied} item{applyResult.applied === 1 ? "" : "s"} updated
              {applyResult.errors > 0 && ` · ${applyResult.errors} failed`}.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-farm-dark/5 flex-shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearAll}
              disabled={loading || applying || selected.size === 0}
              className="text-xs font-medium text-farm-muted hover:text-farm-dark disabled:opacity-40 min-h-0"
            >
              Clear
            </button>
            <p className="text-xs text-farm-muted">
              {selected.size} selected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={loading || applying || selected.size === 0}
              className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-dark transition-colors disabled:opacity-50"
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Apply {selected.size > 0 ? selected.size : ""} match{selected.size === 1 ? "" : "es"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  label, count, description, proposals, selected, onToggle, onSelectAll, warn,
}: {
  label: string;
  count: number;
  description: string;
  proposals: Proposal[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className={`text-[10px] tracking-[0.18em] uppercase font-semibold ${warn ? "text-amber-700" : "text-farm-green"}`}>
            {warn && <AlertTriangle className="inline-block w-3 h-3 mr-1 -mt-0.5" />}
            {label} · {count}
          </p>
          <p className="text-xs text-farm-muted mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-medium text-farm-green hover:underline min-h-0 flex-shrink-0"
        >
          Select all
        </button>
      </div>
      <ul className="space-y-1.5">
        {proposals.map((p) => {
          const isSelected = selected.has(p.itemId);
          return (
            <li
              key={p.itemId}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? "border-farm-green bg-farm-green/5"
                  : "border-farm-dark/10 bg-white hover:bg-farm-cream/40"
              }`}
              onClick={() => onToggle(p.itemId)}
            >
              <div
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                  isSelected ? "bg-farm-green border-farm-green" : "border-farm-dark/20 bg-white"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-farm-cream/60 overflow-hidden">
                <img src={p.photoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-farm-dark truncate">{p.itemName}</p>
                <p className="text-xs text-farm-muted truncate">
                  {p.photoName}
                  {p.currentUrl && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-700">· will overwrite</span>
                  )}
                </p>
              </div>
              <p className="text-xs font-semibold text-farm-muted flex-shrink-0">
                {Math.round(p.confidence * 100)}%
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
