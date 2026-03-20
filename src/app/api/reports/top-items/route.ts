import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/reports/top-items?start=2026-01-01&end=2026-03-31&limit=10
 *
 * Returns most ordered items by frequency and total volume.
 * Uses most_ordered_items view.
 * Filterable by date range.
 *
 * Admin only.
 *
 * TODO: Implement top items query
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const limit = parseInt(searchParams.get("limit") ?? "10");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Query most_ordered_items view with date filters
  void start;
  void end;
  void limit;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
