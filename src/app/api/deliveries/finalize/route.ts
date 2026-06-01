import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/deliveries/finalize
 * Body: { month: "2026-04" }
 * Sets status = 'finalized' for all logged deliveries in the month.
 * Admin only. Irreversible.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { month: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { month } = body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM format" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("deliveries")
    .update({ status: "finalized" })
    .eq("status", "logged")
    .gte("delivery_date", start)
    .lte("delivery_date", end)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ finalized: data?.length ?? 0 });
}
