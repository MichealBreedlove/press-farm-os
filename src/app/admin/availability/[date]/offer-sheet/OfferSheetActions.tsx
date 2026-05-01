"use client";

import Link from "next/link";

interface Props {
  date: string;
  currentRestaurant: string | null;
  restaurants: { id: string; name: string }[];
}

/**
 * Screen-only chrome for the offer sheet — Print button + scope filter.
 * Hidden in print output via `print:hidden` so the printed sheet is
 * just the editorial-magazine layout.
 */
export function OfferSheetActions({ date, currentRestaurant, restaurants }: Props) {
  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto print:hidden">
      <div className="bg-white border border-farm-dark/5 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Scope filter — chips for "All" + each real restaurant */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold mr-1">
            Scope
          </span>
          <Link
            href={`/admin/availability/${date}/offer-sheet`}
            className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition-colors ${
              !currentRestaurant
                ? "bg-farm-green text-white"
                : "bg-farm-cream/60 text-farm-muted hover:bg-farm-cream/80"
            }`}
          >
            All restaurants
          </Link>
          {restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/admin/availability/${date}/offer-sheet?restaurant=${r.id}`}
              className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition-colors ${
                currentRestaurant === r.id
                  ? "bg-farm-green text-white"
                  : "bg-farm-cream/60 text-farm-muted hover:bg-farm-cream/80"
              }`}
            >
              {r.name}
            </Link>
          ))}
        </div>

        {/* Print */}
        <button
          type="button"
          onClick={handlePrint}
          className="min-h-[40px] px-4 rounded-xl bg-farm-green text-white text-sm font-semibold hover:bg-farm-dark transition-colors flex items-center justify-center gap-2 sm:flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save PDF
        </button>
      </div>

      <p className="text-[11px] text-farm-muted text-center mt-2">
        Tip: in the print dialog, choose &quot;Save as PDF&quot; to share digitally.
      </p>
    </div>
  );
}
