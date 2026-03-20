import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/reports/monthly?month=2026-02 — Monthly value report
 *
 * Returns:
 * - Total value by restaurant (Press + Understudy)
 * - Operating cost
 * - Value-to-cost ratio
 * - Top 10 items by value
 * - Top 10 items by quantity
 * - MoM comparison (previous month)
 *
 * Admin only.
 *
 * TODO: Implement monthly report query
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Query financial_periods view + delivery_items aggregations
  void month;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
