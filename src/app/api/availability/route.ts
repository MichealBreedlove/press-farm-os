import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/api-auth";
import { fetchAllRows } from "@/lib/fetch-all";
import { planCarryForward } from "@/lib/availability";
import { todayPacific } from "@/lib/utils";

/**
 * POST /api/availability — Publish availability for a delivery date
 *
 * Body: { restaurant_id, delivery_date, items: [{ item_id, status, limited_qty, cycle_notes }] }
 *
 * Upserts availability_items (stamped published_at). Sets
 * delivery_dates.ordering_open = true. Then copies the same statuses forward
 * to every later date that is still only carried over (see
 * planCarryForward) so a publish doesn't get "undone" by a stale snapshot
 * a chef page view or Copy-last-cycle wrote for a future date earlier.
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = (await createClient()) as any;

  const auth = await requireRole(supabase, ["admin"], { requireActive: true });
  if (!auth.ok) return auth.response;

  let body: {
    restaurant_id: string;
    delivery_date: string;
    restaurantId?: string;
    date?: string;
    items: Array<{
      item_id: string;
      status: string;
      limited_qty?: number | null;
      cycle_notes?: string | null;
      available_sizes?: string | null;
      available_colors?: string | null;
      available_varieties?: string | null;
      available_units?: string | null;
    }>;
    allItemIds?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Support both naming conventions from client
  const restaurant_id = body.restaurant_id || body.restaurantId;
  const delivery_date = body.delivery_date || body.date;
  const { items } = body;

  if (!restaurant_id || !delivery_date || !Array.isArray(items)) {
    return NextResponse.json(
      { error: "Missing required fields: restaurant_id, delivery_date, items" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) {
    return NextResponse.json({ error: "Invalid delivery_date format" }, { status: 400 });
  }

  const VALID_STATUSES = ['available', 'limited', 'unavailable'];
  const invalidItems = items.filter((item: any) => !VALID_STATUSES.includes(item.status));
  if (invalidItems.length > 0) {
    return NextResponse.json({ error: "Invalid status value in items" }, { status: 400 });
  }

  // Use admin client to bypass RLS for upsert
  const adminClient = createAdminClient() as any;

  // Upsert availability_items
  const now = new Date().toISOString();
  const rowsFor = (date: string) =>
    items.map((item) => ({
      item_id: item.item_id,
      restaurant_id,
      delivery_date: date,
      status: item.status as "available" | "limited" | "unavailable",
      limited_qty: item.limited_qty ?? null,
      cycle_notes: item.cycle_notes ?? null,
      available_sizes: item.available_sizes ?? null,
      available_colors: item.available_colors ?? null,
      available_varieties: item.available_varieties ?? null,
      available_units: item.available_units ?? null,
      updated_at: now,
    }));
  const upsertRows = rowsFor(delivery_date).map((r) => ({ ...r, published_at: now }));

  const { error: upsertError } = await adminClient
    .from("availability_items")
    .upsert(upsertRows, {
      onConflict: "item_id,restaurant_id,delivery_date",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    console.error("Upsert availability error:", upsertError);
    return NextResponse.json(
      { error: "Failed to save availability" },
      { status: 500 }
    );
  }

  // Carry this publish forward to later dates that only hold carried-over
  // rows. Those rows are snapshots written ahead of time (a chef opening the
  // order form for a future date materializes it; Copy last cycle copies
  // it), and without this they freeze whatever was available back then —
  // the admin publishes 13 items, but next Thursday still shows the old 24
  // (2026-10-05). published_at is left untouched so they stay "carried" and
  // keep following the next publish. Stops at the next date the admin
  // published themselves. Best-effort: the publish itself already landed.
  const carriedForward: string[] = [];
  const { data: laterRows, error: laterError } = await fetchAllRows(
    (from, to) =>
      adminClient
        .from("availability_items")
        .select("delivery_date, published_at")
        .eq("restaurant_id", restaurant_id)
        .gt("delivery_date", delivery_date)
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (laterError) {
    console.error("Carry-forward read error:", laterError);
  } else {
    const targets = planCarryForward(laterRows as any[], delivery_date, todayPacific());
    for (const target of targets) {
      const { error: cfError } = await adminClient
        .from("availability_items")
        .upsert(rowsFor(target), {
          onConflict: "item_id,restaurant_id,delivery_date",
          ignoreDuplicates: false,
        });
      if (cfError) {
        console.error(`Carry-forward to ${target} error:`, cfError);
        break;
      }
      carriedForward.push(target);
    }
  }

  // Keep the item-level menu flags in step with per-restaurant availability.
  // The chef order forms gate the Events, Press Bar, and Regular menus by
  // global boolean flags on `items` (is_event_item / is_press_bar_item /
  // show_in_regular_menu) — NOT by availability_items rows. So an item marked
  // "available" for Events or Press Bar here would still never appear on those
  // menus unless the matching flag is on. Mirror the toggle: when an item is
  // made available/limited for a restaurant, ensure that restaurant's menu flag
  // is set. Additive only — we never clear a flag, because the per-date row
  // status already hides an item when it's unavailable, and the flag is global
  // across all dates (clearing it would yank the item off every other date).
  const { data: restaurantRow } = await adminClient
    .from("restaurants")
    .select("slug, name")
    .eq("id", restaurant_id)
    .single();

  const slug = String(restaurantRow?.slug ?? "").toLowerCase();
  const rName = String(restaurantRow?.name ?? "").toLowerCase();

  // Resolve which menu flag this restaurant exposes. Check Press Bar before
  // Press, since "Press Bar" also contains "press".
  let flagColumn: "is_event_item" | "is_press_bar_item" | "show_in_regular_menu" | null = null;
  if (slug === "events" || rName.includes("event")) {
    flagColumn = "is_event_item";
  } else if (slug === "press-bar" || rName.includes("bar")) {
    flagColumn = "is_press_bar_item";
  } else if (slug === "press" || slug === "understudy" || rName.includes("press") || rName.includes("under")) {
    flagColumn = "show_in_regular_menu";
  }

  if (flagColumn) {
    const onItemIds = items
      .filter((it) => it.status === "available" || it.status === "limited")
      .map((it) => it.item_id);
    if (onItemIds.length > 0) {
      // .eq(flagColumn, false) so we only touch items that actually need it,
      // avoiding needless updated_at churn across the catalog on every save.
      const { error: flagError } = await adminClient
        .from("items")
        .update({ [flagColumn]: true, updated_at: new Date().toISOString() })
        .in("id", onItemIds)
        .eq(flagColumn, false);
      if (flagError) {
        // Non-fatal — availability saved; the flag sync is best-effort.
        console.error("Sync menu flag error:", flagError);
      }
    }
  }

  // Set ordering_open = true on the delivery date
  const { error: dateError } = await adminClient
    .from("delivery_dates")
    .update({ ordering_open: true })
    .eq("date", delivery_date);

  if (dateError) {
    console.error("Update delivery_dates error:", dateError);
    // Non-fatal — availability was saved, just log it
  }

  return NextResponse.json({ success: true, carried_forward: carriedForward });
}
