import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityEditor } from "@/components/admin/AvailabilityEditor";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    .select("id, farm_id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived, sort_order, created_at, updated_at")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  const items: Item[] = rawItems ?? [];

  if (itemsError) {
    console.error("Error fetching items:", itemsError);
  }

  // Fetch restaurants (both Press + Understudy) for the farm
  const { data: rawRestaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("id, name, slug, farm_id, created_at, updated_at")
    .order("name", { ascending: true });
  const restaurants: Restaurant[] = rawRestaurants ?? [];

  if (restaurantsError) {
    console.error("Error fetching restaurants:", restaurantsError);
  }

  // Fetch existing availability_items for this date across all restaurants
  const { data: rawAvailability, error: availError } = await supabase
    .from("availability_items")
    .select("id, item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes, created_at, updated_at")
    .eq("delivery_date", date);
  const availability: AvailabilityItem[] = rawAvailability ?? [];

  if (availError) {
    console.error("Error fetching availability:", availError);
  }

  const pageTitle = formatPageTitle(date);

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <Link
          href="/admin/availability"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Back to availability"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            {pageTitle}
          </h1>
          <p className="text-xs text-gray-500">
            Ordering is{" "}
            <span
              className={
                deliveryDate.ordering_open ? "text-farm-green font-medium" : "text-red-600 font-medium"
              }
            >
              {deliveryDate.ordering_open ? "open" : "closed"}
            </span>
          </p>
        </div>
      </header>

      <AvailabilityEditor
        items={items}
        availability={availability}
        date={date}
        restaurants={restaurants}
      />
    </main>
  );
}
