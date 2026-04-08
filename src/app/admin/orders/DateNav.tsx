"use client";

import { useRouter } from "next/navigation";

interface DateNavProps {
  currentDate: string;
  prevDate: string | null;
  nextDate: string | null;
  formattedDate: string;
}

/**
 * DateNav — prev/next delivery date navigation for the orders dashboard.
 * Client component — uses router.push to navigate.
 */
export function DateNav({ currentDate, prevDate, nextDate, formattedDate }: DateNavProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 mt-1">
      <button
        onClick={() => prevDate && router.push(`/admin/orders?date=${prevDate}`)}
        disabled={!prevDate}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous delivery date"
      >
        ←
      </button>
      <span className="flex-1 text-center text-sm font-medium text-green-100">
        {formattedDate}
      </span>
      <button
        onClick={() => nextDate && router.push(`/admin/orders?date=${nextDate}`)}
        disabled={!nextDate}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next delivery date"
      >
        →
      </button>
    </div>
  );
}
