"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SeedWithItem } from "@/types";
import { SEED_STATUS_LABELS, type SeedStatus } from "@/lib/constants";

interface Props {
  seeds: SeedWithItem[];
  stats: { active: number; low: number; exhausted: number; oldSeed: number };
}

type StatusFilter = "all" | SeedStatus | "low";

const CURRENT_YEAR = new Date().getFullYear();

function ageBadge(packed: number | null | undefined) {
  if (packed == null) return null;
  const age = CURRENT_YEAR - packed;
  if (age <= 0) return null;
  if (age === 1) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
        Last yr
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-red-50 text-red-800 border border-red-200">
      Old seed
    </span>
  );
}

function statusBadge(status: SeedStatus, isLow: boolean) {
  if (status === "exhausted") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-gray-100 text-gray-600 border border-gray-200">
        Exhausted
      </span>
    );
  }
  if (status === "discarded") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-gray-100 text-gray-500 border border-gray-200">
        Discarded
      </span>
    );
  }
  if (isLow) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200">
      {SEED_STATUS_LABELS[status]}
    </span>
  );
}

function formatQty(n: number, unit: string) {
  const rounded = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded} ${unit}`;
}

export function SeedsClient({ seeds, stats }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [oldOnly, setOldOnly] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of seeds) {
      if (s.item?.category) set.add(s.item.category);
    }
    return Array.from(set).sort();
  }, [seeds]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return seeds.filter((s) => {
      if (statusFilter === "low") {
        if (s.status !== "active" || !s.is_low) return false;
      } else if (statusFilter !== "all" && s.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== "all" && s.item?.category !== categoryFilter) return false;
      if (oldOnly) {
        if (s.packed_for_year == null || s.packed_for_year > CURRENT_YEAR - 2) return false;
      }
      if (needle) {
        const hay = `${s.variety} ${s.item?.name ?? ""} ${s.supplier ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [seeds, search, statusFilter, categoryFilter, oldOnly]);

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Active" value={stats.active} />
        <Stat label="Low" value={stats.low} tone={stats.low > 0 ? "amber" : "muted"} />
        <Stat label="Old" value={stats.oldSeed} tone={stats.oldSeed > 0 ? "red" : "muted"} />
        <Stat label="Used up" value={stats.exhausted} tone="muted" />
      </div>

      {/* Add */}
      <div className="flex justify-end">
        <Link
          href="/admin/seeds/new"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-farm-green text-white text-sm font-medium hover:bg-farm-green/90 min-h-[44px]"
        >
          + Add seed
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search variety, crop, or supplier"
          className="w-full px-3 py-2 rounded-lg border border-farm-dark/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green/30 min-h-[44px]"
        />
        <div className="flex flex-wrap gap-1.5 items-center">
          {(["active", "low", "exhausted", "discarded", "all"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium tracking-wide border ${
                statusFilter === s
                  ? "bg-farm-dark text-white border-farm-dark"
                  : "bg-white text-farm-muted border-farm-dark/15 hover:border-farm-dark/30"
              }`}
            >
              {s === "all" ? "All" : s === "low" ? "Low" : SEED_STATUS_LABELS[s as SeedStatus]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-farm-dark/15 bg-white text-farm-muted"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-farm-dark/15 bg-white text-farm-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={oldOnly}
              onChange={(e) => setOldOnly(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Old seed only
          </label>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-farm-muted py-12 text-center">
          {seeds.length === 0
            ? "No seeds tracked yet. Tap '+ Add seed' to log your first variety."
            : "No seeds match the current filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => {
            const exhausted = s.status === "exhausted" || s.status === "discarded";
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/seeds/${s.id}`}
                  className={`block bg-white border border-farm-dark/10 rounded-xl px-4 py-3 hover:border-farm-dark/25 transition-colors ${
                    exhausted ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-farm-dark leading-tight">
                        {s.variety}
                      </p>
                      <p className="text-xs text-farm-muted mt-0.5 truncate">
                        {s.item?.name ?? "—"}
                        {s.item?.category ? ` · ${s.item.category}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-farm-dark">
                        {formatQty(s.on_hand ?? 0, s.quantity_unit)}
                      </p>
                      <p className="text-[10px] text-farm-muted">
                        of {formatQty(s.initial_quantity, s.quantity_unit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {statusBadge(s.status, s.is_low)}
                    {ageBadge(s.packed_for_year)}
                    {s.latest_germ_pct != null && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-blue-50 text-blue-700 border border-blue-100">
                        Germ {Number(s.latest_germ_pct).toFixed(0)}%
                      </span>
                    )}
                    {s.supplier && (
                      <span className="text-[10px] text-farm-muted truncate">{s.supplier}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "red" | "muted";
}) {
  const valueClass =
    tone === "amber"
      ? "text-amber-800"
      : tone === "red"
        ? "text-red-700"
        : tone === "muted"
          ? "text-farm-muted"
          : "text-farm-green";
  return (
    <div className="bg-white rounded-xl border border-farm-dark/10 px-2 py-3 text-center">
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">{label}</p>
    </div>
  );
}
