/**
 * Availability fetch with auto-rollover.
 *
 * Press Farm's availability is mostly persistent — what's available this week
 * is usually what's available next week, with small tweaks. So when there are
 * no explicit availability_items for a delivery date, fall back to the most
 * recent prior date that has rows.
 *
 * Used by both the chef order form and the admin availability editor.
 */

const AVAIL_SELECT = `
  id, item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes,
  available_sizes, available_colors, available_units, created_at, updated_at,
  item:items(
    id, farm_id, name, category, unit_type, default_price, unit_prices, size_prices, chef_notes,
    internal_notes, source, is_archived, is_event_item, sort_order, image_url,
    season_status, season_note, size, color, created_at, updated_at
  )
`;

const AVAIL_SELECT_BARE = `
  id, item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes,
  available_sizes, available_colors, available_units, created_at, updated_at
`;

interface AvailabilityFetchOptions {
  deliveryDate: string;
  restaurantId: string;
  /** Include the joined items table */
  withItem?: boolean;
  /** Filter out unavailable items (chef view) */
  hideUnavailable?: boolean;
}

/**
 * Fetch availability for a delivery date, falling back to the most recent
 * prior date if no rows exist for the target date.
 *
 * @returns { data: rows[], sourceDate: string } — the date the data actually came from
 */
export async function fetchAvailabilityWithRollover(
  supabase: any,
  opts: AvailabilityFetchOptions
): Promise<{ data: any[]; sourceDate: string; isInherited: boolean }> {
  const { deliveryDate, restaurantId, withItem = true, hideUnavailable = false } = opts;
  const select = withItem ? AVAIL_SELECT : AVAIL_SELECT_BARE;

  // Try the exact date first
  let query = supabase
    .from("availability_items")
    .select(select)
    .eq("delivery_date", deliveryDate)
    .eq("restaurant_id", restaurantId);
  if (hideUnavailable) query = query.neq("status", "unavailable");

  const { data: directData } = await query;

  if ((directData ?? []).length > 0) {
    return {
      data: directData ?? [],
      sourceDate: deliveryDate,
      isInherited: false,
    };
  }

  // The hideUnavailable filter can make a PUBLISHED date look empty when the
  // admin marked everything unavailable. Rolling over in that case resurrects
  // a list the admin explicitly turned off — the chef then builds an order
  // whose availability IDs belong to a prior date and submit rejects it
  // (incident 2026-06-10: Press published all-unavailable for 06-11). Only
  // roll over when the date has NO rows at all for this restaurant.
  if (hideUnavailable) {
    const { data: anyRows } = await supabase
      .from("availability_items")
      .select("id")
      .eq("delivery_date", deliveryDate)
      .eq("restaurant_id", restaurantId)
      .limit(1);
    if ((anyRows ?? []).length > 0) {
      return { data: [], sourceDate: deliveryDate, isInherited: false };
    }
  }

  // No data for this date — find the most recent prior date with availability
  const { data: priorDates } = await supabase
    .from("availability_items")
    .select("delivery_date")
    .eq("restaurant_id", restaurantId)
    .lt("delivery_date", deliveryDate)
    .order("delivery_date", { ascending: false })
    .limit(1);

  const sourceDate = priorDates?.[0]?.delivery_date;
  if (!sourceDate) {
    return { data: [], sourceDate: deliveryDate, isInherited: false };
  }

  // Fetch from prior date
  let priorQuery = supabase
    .from("availability_items")
    .select(select)
    .eq("delivery_date", sourceDate)
    .eq("restaurant_id", restaurantId);
  if (hideUnavailable) priorQuery = priorQuery.neq("status", "unavailable");

  const { data: priorData } = await priorQuery;

  // Map: replace delivery_date with the requested one so the data appears as
  // if it belongs to this delivery (chef sees it as "their" availability).
  // Archived items are dropped — the chef page filters them from display
  // anyway, but if they survive into materializeRollover they become real
  // rows that ride the rollover forward date after date, and can leave a
  // date looking "published" while showing chefs nothing.
  const remapped = (priorData ?? [])
    .filter((row: any) => !(withItem && row.item?.is_archived))
    .map((row: any) => ({
      ...row,
      delivery_date: deliveryDate,
      _inheritedFrom: sourceDate,
    }));

  return {
    data: remapped,
    sourceDate,
    isInherited: true,
  };
}

/**
 * Materialize rolled-over availability into real DB rows for the target
 * date. Required before chefs can submit orders against rolled-over
 * availability — the submit endpoint validates each line by ID against
 * the exact delivery_date, and rolled-over rows still belong to the
 * prior date until materialized here.
 *
 * Idempotent — uses the (item_id, restaurant_id, delivery_date) unique
 * constraint to ignore duplicates if another concurrent request already
 * created the rows. Caller should re-fetch availability after this so
 * the IDs reflect the new rows.
 *
 * Must be called with an admin client (bypasses RLS — chef sessions
 * can't write availability_items).
 */
export async function materializeRollover(
  adminClient: any,
  sourceRows: any[],
  targetDeliveryDate: string,
): Promise<void> {
  // Never materialize archived items — they can't be ordered or displayed,
  // and once written they propagate to every later date via rollover.
  sourceRows = sourceRows.filter((r) => !r.item?.is_archived);
  if (sourceRows.length === 0) return;

  const rowsToInsert = sourceRows.map((r) => ({
    item_id: r.item_id,
    restaurant_id: r.restaurant_id,
    delivery_date: targetDeliveryDate,
    status: r.status ?? "available",
    limited_qty: r.limited_qty ?? null,
    cycle_notes: r.cycle_notes ?? null,
    available_sizes: r.available_sizes ?? null,
    available_colors: r.available_colors ?? null,
    available_units: r.available_units ?? null,
  }));

  const { error } = await adminClient
    .from("availability_items")
    .upsert(rowsToInsert, {
      onConflict: "item_id,restaurant_id,delivery_date",
      ignoreDuplicates: true,
    });

  if (error) {
    console.error("[availability] materializeRollover failed:", error);
  }
}
