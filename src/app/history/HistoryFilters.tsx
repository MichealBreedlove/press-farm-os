"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  statusFilter: string | null;
  monthFilter: string | null;
  months: string[];
  statusOptions: { value: string; label: string }[];
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function href(status: string | null, month: string | null): string {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (month) p.set("month", month);
  const q = p.toString();
  return q ? `/history?${q}` : "/history";
}

/**
 * Status chips (links) + month picker (select → router.push) for /history.
 * Filters live in the URL so Back and refresh keep them.
 */
export function HistoryFilters({ statusFilter, monthFilter, months, statusOptions }: Props) {
  const router = useRouter();
  if (months.length === 0) return null;
  return (
    <div className="mb-4 space-y-2.5">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4" role="group" aria-label="Filter by status">
        {[{ value: null as string | null, label: "All" }, ...statusOptions].map((o) => {
          const on = (o.value ?? null) === statusFilter;
          return (
            <Link
              key={o.value ?? "all"}
              href={href(o.value, monthFilter)}
              aria-current={on ? "true" : undefined}
              className={`flex-shrink-0 rounded-full border px-3 min-h-[36px] inline-flex items-center text-xs font-medium transition-colors ${
                on
                  ? "bg-farm-dark text-white border-farm-dark"
                  : "bg-white text-farm-muted border-farm-dark/10 hover:border-farm-dark/30"
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="history-month" className="text-xs text-farm-muted">
          Month
        </label>
        <select
          id="history-month"
          value={monthFilter ?? ""}
          onChange={(e) => router.push(href(statusFilter, e.target.value || null))}
          className="flex-1 max-w-[220px] rounded-lg border border-farm-dark/10 bg-white px-2 min-h-[40px] text-sm"
        >
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        {(statusFilter || monthFilter) && (
          <Link href="/history" className="text-xs font-medium text-farm-green hover:underline min-h-[36px] inline-flex items-center px-1">
            Clear
          </Link>
        )}
      </div>
    </div>
  );
}
