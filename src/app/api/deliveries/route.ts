import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/deliveries — Log a delivery
 * GET  /api/deliveries — List deliveries (with optional filters)
 *
 * POST Body: { delivery_date, restaurant_id, items: [{ item_id, quantity, unit, unit_price }], notes }
 *
 * Admin only.
 *
 * TODO: Implement delivery log logic
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Fetch deliveries with filters (month, restaurant)
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Upsert delivery + delivery_items, trigger total recalculation
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
