import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types";

/**
 * POST /api/availability — Publish availability for a delivery date
 *
 * Body: { restaurant_id, delivery_date, items: [{ item_id, status, limited_qty, cycle_notes }] }
 *
 * Upserts availability_items. Sets delivery_dates.ordering_open = true.
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

  let body: {
    restaurant_id: string;
    delivery_date: string;
    items: Array<{
      item_id: string;
      status: string;
      limited_qty?: number | null;
      cycle_notes?: string | null;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { restaurant_id, delivery_date, items } = body;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // Upsert availability_items
  const upsertRows = items.map((item) => ({
    item_id: item.item_id,
    restaurant_id,
    delivery_date,
    status: item.status as "available" | "limited" | "unavailable",
    limited_qty: item.limited_qty ?? null,
    cycle_notes: item.cycle_notes ?? null,
    updated_at: new Date().toISOString(),
  }));

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

  // Set ordering_open = true on the delivery date
  const { error: dateError } = await adminClient
    .from("delivery_dates")
    .update({ ordering_open: true })
    .eq("date", delivery_date);

  if (dateError) {
    console.error("Update delivery_dates error:", dateError);
    // Non-fatal — availability was saved, just log it
  }

  return NextResponse.json({ success: true });
}
