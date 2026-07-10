import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilityItem } from "@/types";
import { requireRole } from "@/lib/api-auth";

/**
 * POST /api/availability/duplicate — Duplicate last cycle's availability
 *
 * Body: { restaurant_id, target_date }
 *
 * Finds most recent availability for restaurant before target_date,
 * copies all rows to target_date. Copies: item_id, status, limited_qty, cycle_notes.
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = (await createClient()) as any;

  const auth = await requireRole(supabase, ["admin"], { requireActive: true });
  if (!auth.ok) return auth.response;

  let body: { restaurant_id: string; target_date: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { restaurant_id, target_date } = body;

  if (!restaurant_id || !target_date) {
    return NextResponse.json(
      { error: "Missing required fields: restaurant_id, target_date" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
    return NextResponse.json({ error: "Invalid target_date format" }, { status: 400 });
  }

  const adminClient = createAdminClient() as any;

  // Find the most recent delivery date before target_date that has availability rows
  const { data: rawLastRows, error: findError } = await adminClient
    .from("availability_items")
    .select("delivery_date, item_id, status, limited_qty, cycle_notes, available_sizes, available_colors, available_varieties, available_units")
    .eq("restaurant_id", restaurant_id)
    .lt("delivery_date", target_date)
    .order("delivery_date", { ascending: false })
    .limit(500);
  const lastRows = rawLastRows as (Pick<AvailabilityItem, "delivery_date" | "item_id" | "status" | "limited_qty" | "cycle_notes"> & { available_sizes: string | null; available_colors: string | null; available_varieties: string | null; available_units: string | null })[] | null;

  if (findError) {
    console.error("Find last cycle error:", findError);
    return NextResponse.json({ error: "Failed to find last cycle" }, { status: 500 });
  }

  if (!lastRows || lastRows.length === 0) {
    return NextResponse.json(
      { error: "No previous availability found for this restaurant" },
      { status: 404 }
    );
  }

  // Get the most recent date's rows
  const mostRecentDate = lastRows[0].delivery_date;
  const sourceRows = lastRows.filter((r) => r.delivery_date === mostRecentDate);

  // Build upsert rows for target_date
  const upsertRows = sourceRows.map((row) => ({
    item_id: row.item_id,
    restaurant_id,
    delivery_date: target_date,
    status: row.status,
    limited_qty: row.limited_qty,
    cycle_notes: row.cycle_notes,
    available_sizes: row.available_sizes,
    available_colors: row.available_colors,
    available_varieties: row.available_varieties,
    available_units: row.available_units,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await adminClient
    .from("availability_items")
    .upsert(upsertRows, {
      onConflict: "item_id,restaurant_id,delivery_date",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    console.error("Duplicate upsert error:", upsertError);
    return NextResponse.json(
      { error: "Failed to duplicate availability" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    source_date: mostRecentDate,
    rows_copied: upsertRows.length,
  });
}
