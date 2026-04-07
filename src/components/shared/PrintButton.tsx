"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print-hide flex items-center gap-1.5 text-sm text-farm-green font-medium min-h-[44px] px-3"
    >
      <Printer className="w-4 h-4" />
      Print
    </button>
  );
}
