import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import type { DeliveryDate } from "@/types";
import { AddDatesButton } from "./AddDatesButton";
import { CopyLastCycleButton } from "./CopyLastCycleButton";
import { todayPacific } from "@/lib/utils";

/**
 * /admin/availability — Availability dashboard
 *
 * Shows upcoming delivery dates with availability status.
 * Admin selects a date to edit availability.
 */

function formatDeliveryDate(dateStr: string): string {
  // Parse date parts directly to avoid timezone offset issues
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default async function AdminAvailabilityPage() {
  const supabase = (await createClient()) as any;
  const today = todayPacific();

  // Restaurants — the list-level "copy last cycle" runs per restaurant.
  const { data: restaurantRows } = await supabase
    .from("restaurants")
    .select("id, name")
    .order("name", { ascending: true });
  const restaurants: { id: string; name: string }[] = restaurantRows ?? [];

  // Fetch upcoming delivery dates
  const { data: rawDates, error } = await supabase
    .from("delivery_dates")
    .select("id, date, day_of_week, ordering_open")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(12);

  if (error) {
    console.error("Error fetching delivery dates:", error);
  }

  // For each date, count the orderable items (available + limited) across
  // all restaurants. Limited items ARE orderable, so a date that is all
  // limited is not "No availability set" (2026-10-08).
  const dates: DeliveryDate[] = rawDates ?? [];
  const dateStrings = dates.map((d) => d.date);

  const countsByDate: Record<string, { available: number; limited: number }> = {};

  if (dateStrings.length > 0) {
    // Paginated: 12 dates × ~120 available rows each clears the silent
    // 1,000-row response cap, which would zero out the later dates' badges.
    const { data: availCounts } = await fetchAllRows(
      (from, to) =>
        supabase
          .from("availability_items")
          .select("delivery_date, item_id, status")
          .in("delivery_date", dateStrings)
          .in("status", ["available", "limited"])
          .order("id", { ascending: true })
          .range(from, to),
    );

    if (availCounts) {
      // Deduplicate by item_id per date to avoid double-counting across
      // restaurants. An item available anywhere counts as available.
      const statusByDate: Record<string, Map<string, string>> = {};
      for (const row of availCounts as Array<{ delivery_date: string; item_id: string; status: string }>) {
        const map = (statusByDate[row.delivery_date] ??= new Map());
        if (map.get(row.item_id) !== "available") map.set(row.item_id, row.status);
      }
      for (const [date, map] of Object.entries(statusByDate)) {
        let available = 0;
        let limited = 0;
        for (const status of Array.from(map.values())) {
          if (status === "available") available++;
          else limited++;
        }
        countsByDate[date] = { available, limited };
      }
    }
  }

  return (
    <main>
      {/* Single compact header — the hero block was redundant with this bar
          and pushed the date list below the fold on a phone. */}
      <header className="page-header">
        <h1 className="page-title">Availability</h1>
        <p className="text-xs text-white/60">
          {dates.length > 0
            ? `${dates.length} upcoming cycle${dates.length === 1 ? "" : "s"} · tap a date to set availability`
            : "No cycles scheduled — add delivery dates below"}
        </p>
      </header>

      <div className="px-4 py-4 max-w-3xl mx-auto space-y-3">
        {dates.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-farm-muted text-sm">No upcoming delivery dates found.</p>
            <p className="text-farm-muted text-xs mt-1">Add delivery dates below to get started.</p>
          </div>
        )}

        {dates.map((dd) => {
          const counts = countsByDate[dd.date] ?? { available: 0, limited: 0 };
          const orderableCount = counts.available + counts.limited;
          return (
            <div key={dd.id} className="space-y-1">
            <Link
              href={`/admin/availability/${dd.date}`}
              className="block card-interactive px-4 py-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-farm-dark text-base">
                    {formatDeliveryDate(dd.date)}
                  </p>
                  <p className="text-sm text-farm-muted mt-0.5">
                    {orderableCount > 0
                      ? `${counts.available} available${counts.limited > 0 ? ` · ${counts.limited} limited` : ""}`
                      : "No availability set"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 ml-3 shrink-0">
                  <span
                    className={dd.ordering_open ? "badge-green" : "badge-red"}
                  >
                    {dd.ordering_open ? "Open" : "Closed"}
                  </span>
                  <svg
                    className="w-4 h-4 text-farm-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
            {orderableCount === 0 && (
              <CopyLastCycleButton targetDate={dd.date} restaurants={restaurants} />
            )}
            </div>
          );
        })}
      </div>

      {/* Add Delivery Dates section */}
      <div className="px-4 pb-6 mt-2">
        <AddDatesButton />
      </div>
    </main>
  );
}
