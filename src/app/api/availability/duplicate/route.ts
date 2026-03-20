import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/availability/duplicate — Duplicate last cycle's availability
 *
 * Body: { restaurant_id, target_date }
 *
 * Finds most recent availability for restaurant, copies all rows to target_date.
 * Copies: item_id, status, limited_qty, cycle_notes.
 * Admin only.
 *
 * TODO: Implement duplicate availability logic
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Verify admin, find last cycle, duplicate rows
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
