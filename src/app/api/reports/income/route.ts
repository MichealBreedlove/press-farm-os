import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/reports/income?quarter=Q1-2026 — Quarterly income statement
 *
 * Returns: production value, expenses breakdown, net margin.
 * Benchmark: Q1 2026 = $21,633 value / $1,536 expenses / $12K farmer pay.
 *
 * Admin only.
 *
 * TODO: Implement income statement query
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const quarter = searchParams.get("quarter");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Aggregate delivery values + expenses for quarter
  void quarter;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
