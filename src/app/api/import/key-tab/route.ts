import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/import/key-tab — Import 289-item KEY tab from Daily Delivery Tracking Sheet
 *
 * Accepts multipart form with .xlsx file upload.
 * Parses KEY tab with SheetJS: Item Name, Unit, Price Per Unit.
 * Creates items + price_catalog entries.
 * Returns preview before actual import (query param: ?preview=true).
 *
 * Admin only.
 *
 * TODO: Implement SheetJS parsing + batch insert
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO:
  // 1. Parse multipart form to get .xlsx file
  // 2. Use SheetJS (xlsx) to read KEY tab
  // 3. Map rows: Item Name → items.name, Unit → price_catalog.unit, Price → price_catalog.price_per_unit
  // 4. Auto-categorize by keyword matching (Nasturtium → flowers, etc.)
  // 5. If ?preview=true, return parsed rows without inserting
  // 6. Otherwise, batch insert via adminClient (bypasses RLS)

  const _adminClient = createAdminClient();
  void _adminClient;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
