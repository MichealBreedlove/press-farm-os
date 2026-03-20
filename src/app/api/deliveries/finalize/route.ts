import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/deliveries/finalize — Finalize all deliveries for a month
 *
 * Body: { month: "2026-02" }
 *
 * Sets status = 'finalized' for all logged deliveries in the month.
 * Feeds into financial_periods view.
 * Admin only. Irreversible — confirm before calling.
 *
 * TODO: Implement month finalization
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Verify admin, update all deliveries for month to finalized
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
