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
  available_sizes, available_colors, created_at, updated_at,
  item:items(
    id, farm_id, name, category, unit_type, default_price, chef_notes,
    internal_notes, source, is_archived, sort_order, image_url,
    season_status, season_note, size, color, created_at, updated_at
  )
`;

const AVAIL_SELECT_BARE = `
  id, item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes,
  available_sizes, available_colors, created_at, updated_at
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
  // if it belongs to this delivery (chef sees it as "their" availability)
  const remapped = (priorData ?? []).map((row: any) => ({
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
