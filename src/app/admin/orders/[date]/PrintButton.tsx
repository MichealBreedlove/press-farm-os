"use client";

import { Printer, Share2 } from "lucide-react";

/**
 * PrintButton — triggers window.print() for the combined order + harvest
 * page. Also offers native share if available (iOS Safari "Save as PDF").
 */
export function PrintButton() {
  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          url: window.location.href,
        });
      } catch {
        // User cancelled or not supported — fall back to print
        window.print();
      }
    } else {
      window.print();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => window.print()}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors"
        title="Print harvest list"
      >
        <Printer className="w-5 h-5" />
      </button>
      <button
        onClick={handleShare}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors"
        title="Share / Save PDF"
      >
        <Share2 className="w-5 h-5" />
      </button>
    </div>
  );
}
