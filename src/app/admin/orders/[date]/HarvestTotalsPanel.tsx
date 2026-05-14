"use client";

import { useState } from "react";
import { UNIT_LABELS } from "@/lib/constants";

interface HarvestRow {
  itemName: string;
  unit: string;
  total: number;
  byRestaurant: Array<{ name: string; qty: number }>;
}

/**
 * Aggregate-harvest panel at the top of the unified pick page. Shows
 * total qty per (item, container) across every restaurant for the date
 * — what to grab from the field before the per-restaurant pack split.
 * Defaults open when this is the harvest workflow's primary view;
 * caller passes defaultOpen={false} for any context where the panel
 * is a secondary glance.
 */
export function HarvestTotalsPanel({
  rows,
  printHref,
  defaultOpen = false,
}: {
  rows: HarvestRow[];
  printHref: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (rows.length === 0) return null;

  const totalLines = rows.length;

  return (
    <section className="bg-white rounded-xl border border-farm-dark/5 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-farm-cream/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span aria-hidden="true" className="text-lg">🧺</span>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-farm-dark">Harvest totals</p>
            <p className="text-[11px] text-farm-muted mt-0.5">
              {totalLines} line{totalLines === 1 ? "" : "s"} · combined across restaurants
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-farm-green font-medium hover:underline"
            title="Open the print-optimized harvest list in a new tab"
          >
            Print
          </a>
          <svg
            className={`w-4 h-4 text-farm-muted transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <ul className="divide-y divide-farm-dark/5 border-t border-farm-dark/5 max-h-[40vh] overflow-y-auto">
          {rows.map((row, i) => (
            <li
              key={`${row.itemName}-${row.unit}-${i}`}
              className="px-4 py-2 flex items-center gap-3"
            >
              <span className="flex-1 text-sm text-farm-dark truncate">{row.itemName}</span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-farm-green/15 text-farm-green tabular-nums flex-shrink-0">
                {(UNIT_LABELS[row.unit as keyof typeof UNIT_LABELS] ?? row.unit ?? "—")
                  .toString()
                  .toUpperCase()}
              </span>
              <span className="text-[10px] text-farm-muted/80 tabular-nums w-32 text-right truncate">
                {row.byRestaurant
                  .map((r) => `${shortName(r.name)} ${r.qty}`)
                  .join(" · ")}
              </span>
              <span className="text-sm font-bold text-farm-dark tabular-nums w-10 text-right">
                {row.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function shortName(name: string): string {
  const n = name.toLowerCase().trim();
  if (n.includes("press bar")) return "PB";
  if (n.includes("press")) return "P";
  if (n.includes("under")) return "U";
  if (n.includes("event")) return "E";
  return name[0]?.toUpperCase() ?? "?";
}
