import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/import/delivery-history — Import DELIVERY TRACKER tab
 *
 * Accepts multipart form with .xlsx file.
 * Parses DELIVERY TRACKER tab: Date, Item, Quantity, Unit, Price, Total.
 * Groups by date → creates deliveries rows.
 * Each line → creates delivery_items rows.
 * Items matched by name to imported catalog.
 * Status = 'finalized' for all historical imports.
 *
 * Admin only.
 *
 * TODO: Implement delivery history import
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Parse DELIVERY TRACKER tab, match items, batch insert
  const _adminClient = createAdminClient();
  void _adminClient;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
