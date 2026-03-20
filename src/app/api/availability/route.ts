import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/availability — Publish availability for a delivery date
 *
 * Body: { restaurant_id, delivery_date, items: [{ item_id, status, limited_qty, cycle_notes }] }
 *
 * Upserts availability_items. Sets delivery_dates.ordering_open = true.
 * Sends "availability published" email to all chefs for the restaurant.
 *
 * Admin only.
 *
 * TODO: Implement availability publish logic
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Verify admin, upsert availability_items, send notifications
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
