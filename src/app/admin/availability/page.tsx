import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryDate } from "@/types";
import { AddDatesButton } from "./AddDatesButton";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const today = new Date().toISOString().split("T")[0];

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

  // For each date, fetch count of available items across both restaurants
  const dates: DeliveryDate[] = rawDates ?? [];
  const dateStrings = dates.map((d) => d.date);

  const availabilityCountsByDate: Record<string, number> = {};

  if (dateStrings.length > 0) {
    const { data: availCounts } = await supabase
      .from("availability_items")
      .select("delivery_date, item_id, status")
      .in("delivery_date", dateStrings)
      .eq("status", "available");

    if (availCounts) {
      // Deduplicate by item_id per date to avoid double-counting across restaurants
      const seenByDate: Record<string, Set<string>> = {};
      for (const row of availCounts as Array<{ delivery_date: string; item_id: string; status: string }>) {
        if (!seenByDate[row.delivery_date]) {
          seenByDate[row.delivery_date] = new Set();
        }
        seenByDate[row.delivery_date].add(row.item_id);
      }
      for (const [date, itemIds] of Object.entries(seenByDate)) {
        availabilityCountsByDate[date] = itemIds.size;
      }
    }
  }

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">Availability</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tap a date to set item availability
        </p>
      </header>

      <div className="px-4 py-4 space-y-3">
        {dates.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-400 text-sm">No upcoming delivery dates found.</p>
            <p className="text-gray-400 text-xs mt-1">Add delivery dates below to get started.</p>
          </div>
        )}

        {dates.map((dd) => {
          const availableCount = availabilityCountsByDate[dd.date] ?? 0;
          return (
            <Link
              key={dd.id}
              href={`/admin/availability/${dd.date}`}
              className="block card-interactive px-4 py-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-farm-dark text-base">
                    {formatDeliveryDate(dd.date)}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {availableCount > 0
                      ? `${availableCount} items available`
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
                    className="w-4 h-4 text-gray-400"
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
