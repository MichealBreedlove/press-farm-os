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
  available_sizes, available_colors, available_varieties, available_units, created_at, updated_at,
  item:items(
    id, farm_id, name, category, unit_type, default_price, unit_prices, size_prices, chef_notes,
    internal_notes, source, is_archived, is_event_item, is_press_bar_item, show_in_regular_menu,
    sort_order, image_url, season_status, season_note, size, color, variety, created_at, updated_at
  )
`;

const AVAIL_SELECT_BARE = `
  id, item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes,
  available_sizes, available_colors, available_varieties, available_units, created_at, updated_at
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
  const sourceDate = await findRolloverSourceDate(supabase, restaurantId, deliveryDate);
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
 * The date a restaurant's availability should roll over FROM: the most
 * recent prior date the admin actually published (published_at set),
 * falling back to the most recent prior date with any rows.
 *
 * Preferring published dates matters because future dates get rows written
 * early — materializeRollover on a chef page view, "Copy last cycle" — and
 * those are frozen snapshots. Rolling over from one of them resurrects
 * whatever was available when the snapshot was taken, not what the admin
 * published since (2026-10-05: Under-Study kept showing 24 available after
 * the admin published 13).
 */
export async function findRolloverSourceDate(
  supabase: any,
  restaurantId: string,
  beforeDate: string,
): Promise<string | null> {
  const { data: published } = await supabase
    .from("availability_items")
    .select("delivery_date")
    .eq("restaurant_id", restaurantId)
    .lt("delivery_date", beforeDate)
    .not("published_at", "is", null)
    .order("delivery_date", { ascending: false })
    .limit(1);
  if (published?.[0]?.delivery_date) return published[0].delivery_date;

  const { data: latest } = await supabase
    .from("availability_items")
    .select("delivery_date")
    .eq("restaurant_id", restaurantId)
    .lt("delivery_date", beforeDate)
    .order("delivery_date", { ascending: false })
    .limit(1);
  return latest?.[0]?.delivery_date ?? null;
}

/**
 * Which later dates a publish of `publishedDate` should be copied forward
 * to, split by how much of the publish they take:
 *
 * - `carried`: every later date (not in the past) that is still only
 *   carried over — no published rows — up to the next date the admin
 *   published themselves. These are snapshots of an older publish, so the
 *   WHOLE list is copied over them.
 * - `published`: the next published date and everything after it (published
 *   or not). The admin set those up deliberately, so only the items the
 *   admin CHANGED in this save are pushed into them (see
 *   diffAvailabilityPayload) — a change made on one date carries onward
 *   until the admin changes it again on a later date, but a later publish
 *   keeps everything that wasn't touched.
 *
 * Pure so it can be unit-tested.
 */
export function planCarryForward(
  laterRows: { delivery_date: string; published_at: string | null }[],
  publishedDate: string,
  today: string,
): { carried: string[]; published: string[] } {
  const publishedByDate = new Map<string, boolean>();
  for (const r of laterRows) {
    if (r.delivery_date <= publishedDate) continue;
    publishedByDate.set(
      r.delivery_date,
      (publishedByDate.get(r.delivery_date) ?? false) || r.published_at != null,
    );
  }
  const carried: string[] = [];
  const published: string[] = [];
  let hitPublished = false;
  for (const date of Array.from(publishedByDate.keys()).sort()) {
    if (publishedByDate.get(date)) hitPublished = true;
    if (date < today) continue;
    (hitPublished ? published : carried).push(date);
  }
  return { carried, published };
}

/** The per-item fields an editor Save writes (status + the shared dimensions). */
export interface AvailabilityPayloadRow {
  item_id: string;
  status: string;
  limited_qty?: number | null;
  cycle_notes?: string | null;
  available_sizes?: string | null;
  available_colors?: string | null;
  available_varieties?: string | null;
  available_units?: string | null;
}

function normalizeAvailabilityRow(r: AvailabilityPayloadRow): string {
  // "" and null both mean "no note" / "all units"; for sizes / colors /
  // varieties "" is a real value (none selected) and must stay distinct.
  return JSON.stringify([
    r.status,
    r.limited_qty ?? null,
    (r.cycle_notes ?? "").trim() || null,
    r.available_sizes ?? null,
    r.available_colors ?? null,
    r.available_varieties ?? null,
    r.available_units || null,
  ]);
}

/**
 * Item ids whose saved state differs from what the editor was showing before
 * the save (`baseline`: the date's existing rows, or the rows it was carried
 * over from when it had none). Items with no baseline row count as changed.
 *
 * Pure so it can be unit-tested.
 */
export function diffAvailabilityPayload(
  payload: AvailabilityPayloadRow[],
  baseline: AvailabilityPayloadRow[],
): string[] {
  const before = new Map(baseline.map((r) => [r.item_id, normalizeAvailabilityRow(r)]));
  const changed: string[] = [];
  for (const row of payload) {
    const prev = before.get(row.item_id);
    if (prev === undefined || prev !== normalizeAvailabilityRow(row)) changed.push(row.item_id);
  }
  return changed;
}

/**
 * Rewrite inherited (prior-date) rows so they carry the TARGET date's row
 * ids. `targetRows` are the real rows for the target date (from an admin
 * select after materializing); matching is by item_id, which is what the
 * (item_id, restaurant_id, delivery_date) unique key pins down. Rows with no
 * target counterpart are dropped — the submit endpoint would reject their
 * stale id anyway.
 *
 * Pure so it can be unit-tested; materializeRollover applies it.
 */
export function remapInheritedRows<T extends { item_id: string }>(
  sourceRows: T[],
  targetRows: { id: string; item_id: string }[],
  targetDeliveryDate: string,
): T[] {
  const idByItem = new Map(targetRows.map((r) => [r.item_id, r.id]));
  const out: T[] = [];
  for (const row of sourceRows) {
    const id = idByItem.get(row.item_id);
    if (!id) continue;
    const { _inheritedFrom: _drop, ...rest } = row as any;
    out.push({ ...rest, id, delivery_date: targetDeliveryDate } as T);
  }
  return out;
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
 * created the rows.
 *
 * RETURNS the source rows rewritten with the target date's real ids
 * (see remapInheritedRows). Callers must render THESE rows — do NOT
 * re-run fetchAvailabilityWithRollover afterwards. React memoizes
 * identical GET requests for the lifetime of a server-component render,
 * so a second, byte-identical Supabase select in the same render never
 * hits the network: it replays the pre-insert (empty) result, the
 * rollover branch replays too, and the form ships with the PRIOR date's
 * ids. That is exactly what happened on 2026-09-03 01:04 PT — the
 * Supabase API log shows the four rollover reads, the upsert, and then
 * no refetch at all — and every first-load submit for a rolled-over date
 * failed with "the availability list changed" until the chef reloaded.
 * The id lookup below goes through the admin client (different auth
 * header → different memo key) and is a query shape this render has not
 * issued before, so it is served fresh.
 *
 * Must be called with an admin client (bypasses RLS — chef sessions
 * can't write availability_items).
 */
export async function materializeRollover<T extends { item_id: string; item?: any }>(
  adminClient: any,
  sourceRows: T[],
  targetDeliveryDate: string,
): Promise<T[]> {
  // Never materialize archived items — they can't be ordered or displayed,
  // and once written they propagate to every later date via rollover.
  sourceRows = sourceRows.filter((r) => !r.item?.is_archived);
  if (sourceRows.length === 0) return [];

  const rowsToInsert = sourceRows.map((r: any) => ({
    item_id: r.item_id,
    restaurant_id: r.restaurant_id,
    delivery_date: targetDeliveryDate,
    status: r.status ?? "available",
    limited_qty: r.limited_qty ?? null,
    cycle_notes: r.cycle_notes ?? null,
    available_sizes: r.available_sizes ?? null,
    available_colors: r.available_colors ?? null,
    available_varieties: r.available_varieties ?? null,
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
    // Nothing was written, so there are no target-date ids to hand back.
    // Returning the inherited rows would put prior-date ids on the form and
    // guarantee a failed submit; an empty list at least fails visibly.
    return [];
  }

  // ON CONFLICT DO NOTHING only returns the rows it inserted, so read the
  // full target-date set back to pick up ids that already existed.
  const restaurantId = (sourceRows[0] as any).restaurant_id;
  const { data: targetRows, error: readError } = await adminClient
    .from("availability_items")
    .select("id, item_id")
    .eq("restaurant_id", restaurantId)
    .eq("delivery_date", targetDeliveryDate)
    .in("item_id", sourceRows.map((r) => r.item_id));

  if (readError) {
    console.error("[availability] materializeRollover id read failed:", readError);
    return [];
  }

  return remapInheritedRows(sourceRows, targetRows ?? [], targetDeliveryDate);
}
