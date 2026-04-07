import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, AvailabilityItem } from "@/types";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as Pick<Profile, "role" | "is_active"> | null;

  if (!profile || profile.role !== "admin" || !profile.is_active) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // Find the most recent delivery date before target_date that has availability rows
  const { data: rawLastRows, error: findError } = await adminClient
    .from("availability_items")
    .select("delivery_date, item_id, status, limited_qty, cycle_notes")
    .eq("restaurant_id", restaurant_id)
    .lt("delivery_date", target_date)
    .order("delivery_date", { ascending: false });
  const lastRows = rawLastRows as Pick<AvailabilityItem, "delivery_date" | "item_id" | "status" | "limited_qty" | "cycle_notes">[] | null;

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
  const sourcRows = lastRows.filter((r) => r.delivery_date === mostRecentDate);

  // Build upsert rows for target_date
  const upsertRows = sourcRows.map((row) => ({
    item_id: row.item_id,
    restaurant_id,
    delivery_date: target_date,
    status: row.status,
    limited_qty: row.limited_qty,
    cycle_notes: row.cycle_notes,
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
