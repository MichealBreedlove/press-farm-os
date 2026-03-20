import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/orders — Submit or update an order
 *
 * Body: { restaurant_id, delivery_date, items: [{availability_item_id, quantity}], freeform_notes }
 *
 * Creates order if none exists for restaurant+date.
 * Updates existing order if already created.
 * Triggers email notifications via Resend.
 *
 * TODO: Implement order submission logic
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Parse body, upsert order, upsert order_items, send notifications
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
