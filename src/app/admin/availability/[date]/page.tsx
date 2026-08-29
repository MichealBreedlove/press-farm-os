import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import { AvailabilityEditor } from "@/components/admin/AvailabilityEditor";
import { SendAvailabilityButton } from "../SendAvailabilityButton";
import type { Item, Restaurant, AvailabilityItem } from "@/types";

/**
 * /admin/availability/[date] — Edit availability for a delivery date
 *
 * Server Component: fetches all items, restaurants, and existing availability.
 * Renders AvailabilityEditor client component for interactive editing.
 */

function formatPageTitle(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default async function AdminAvailabilityEditorPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const supabase = (await createClient()) as any;

  // Verify this is a real delivery date
  const { data: rawDeliveryDate } = await supabase
    .from("delivery_dates")
    .select("id, date, ordering_open")
    .eq("date", date)
    .single();
  const deliveryDate = rawDeliveryDate as { id: string; date: string; ordering_open: boolean } | null;

  if (!deliveryDate) {
    notFound();
  }

  // Fetch all non-archived items, ordered by sort_order + name
  const { data: rawItems, error: itemsError } = await supabase
    .from("items")
    .select("id, farm_id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived, sort_order, size, color, variety, created_at, updated_at")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  const items: Item[] = rawItems ?? [];

  if (itemsError) {
    console.error("Error fetching items:", itemsError);
  }

  // Fetch every customer restaurant on the farm (Press, Understudy,
  // Press Bar, Events). The editor renders a per-restaurant chip per
  // item, so this list drives column count downstream.
  const { data: rawRestaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("id, name, slug, farm_id, created_at, updated_at")
    .order("name", { ascending: true });
  const restaurants: Restaurant[] = rawRestaurants ?? [];

  if (restaurantsError) {
    console.error("Error fetching restaurants:", restaurantsError);
  }

  // Fetch existing availability_items for this date across all restaurants.
  // MUST be paginated: a fully published date carries ~1,170 rows (every
  // catalog item × 4 restaurants), past Supabase's silent 1,000-row cap.
  // A truncated read here is what the editor SAVES BACK — missing rows
  // seed "unavailable" and one Save wipes them for real (2026-08-28
  // incident: Press went out with 7 orderable items instead of 29).
  const { data: rawAvailability, error: availError } = await fetchAllRows(
    (from, to) =>
      supabase
        .from("availability_items")
        .select("id, item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes, available_sizes, available_colors, available_varieties, available_units, created_at, updated_at")
        .eq("delivery_date", date)
        .order("id", { ascending: true })
        .range(from, to),
  );
  let availability: AvailabilityItem[] = rawAvailability ?? [];
  let inheritedFromDate: string | null = null;

  if (availError) {
    console.error("Error fetching availability:", availError);
  }

  // Persistent availability: pre-fill each restaurant that has zero rows for
  // this date from ITS most recent prior date. Admin still needs to hit Save
  // to persist, but the form shows what they had last time.
  //
  // This must be per-restaurant, not all-or-nothing: a chef page view can
  // materialize rows for one restaurant days early, after which an
  // all-or-nothing check sees "rows exist" and skips carry-over for the
  // OTHERS — they then seed all-unavailable in the editor and one Save
  // publishes them that way (2026-06-10 incident: Press went out 277/277
  // unavailable because Press Bar + Under-Study already had rows).
  const restaurantsWithRows = new Set(availability.map((a) => a.restaurant_id));
  const missingRestaurants = restaurants.filter((r) => !restaurantsWithRows.has(r.id));

  for (const r of missingRestaurants) {
    const { data: priorDateRow } = await supabase
      .from("availability_items")
      .select("delivery_date")
      .eq("restaurant_id", r.id)
      .lt("delivery_date", date)
      .order("delivery_date", { ascending: false })
      .limit(1)
      .single() as any;

    if (!priorDateRow?.delivery_date) continue;

    inheritedFromDate = priorDateRow.delivery_date;
    const { data: priorRows } = await supabase
      .from("availability_items")
      .select("id, item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes, available_sizes, available_colors, available_varieties, available_units, created_at, updated_at")
      .eq("delivery_date", priorDateRow.delivery_date)
      .eq("restaurant_id", r.id);

    // Remap delivery_date so the editor shows them as belonging to this date
    availability = availability.concat(
      (priorRows ?? []).map((r2: any) => ({
        ...r2,
        delivery_date: date,
      })),
    );
  }

  const pageTitle = formatPageTitle(date);

  return (
    <main>
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/availability"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white transition-colors"
            aria-label="Back to availability"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="page-title truncate">{pageTitle}</h1>
            <p className="text-xs text-white/60">
              Ordering is{" "}
              <span className={deliveryDate.ordering_open ? "text-green-200 font-medium" : "text-red-300 font-medium"}>
                {deliveryDate.ordering_open ? "open" : "closed"}
              </span>
            </p>
          </div>
        </div>
      </header>
      {/* Slim utility strip — the hero block repeated the header's date +
          ordering status and pushed the editor below the fold on a phone.
          Carried-over notice (left) + offer-sheet link (right) share one row. */}
      <div className="bg-farm-cream/60 border-b border-pf-master-gold/20 px-4 py-2 flex items-center gap-3 text-xs">
        <div className="flex-1 min-w-0 text-farm-dark">
          {inheritedFromDate ? (
            <p className="truncate">
              <span className="text-farm-green">↻</span>{" "}
              <span className="font-semibold">
                Carried over from {new Date(inheritedFromDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>{" "}
              — save to publish this date.
            </p>
          ) : (
            <p className="text-farm-muted">Tap items to mark available, limited, or unavailable.</p>
          )}
        </div>
        <a
          href={`/admin/availability/${date}/offer-sheet`}
          className="inline-flex items-center gap-1.5 text-farm-green font-medium hover:underline flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h6m0 0l-3-3m3 3l-3 3" />
          </svg>
          Offer Sheet
        </a>
      </div>

      <AvailabilityEditor
        items={items}
        availability={availability}
        date={date}
        restaurants={restaurants}
      />

      {/* Spacer for fixed footer */}
      <div className="h-40" />
    </main>
  );
}
