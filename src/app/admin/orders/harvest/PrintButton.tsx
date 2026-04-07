"use client";

/**
 * PrintButton — triggers window.print() for the harvest list.
 */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="min-h-[44px] px-4 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:bg-gray-700 transition-colors"
    >
      Print
    </button>
  );
}
