import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayPacific } from "@/lib/utils";
import { rollupByMonth } from "@/lib/reports/aggregate";

/**
 * GET /api/reports/monthly?months=12
 * Returns monthly delivery totals + expenses for the last N months.
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const months = Math.min(parseInt(searchParams.get("months") ?? "12"), 24);

  const admin = createAdminClient();

  // Fetch deliveries for the last N months
  const [ty, tm] = todayPacific().split("-").map(Number);
  const startMonths = ty * 12 + (tm - 1) - (months - 1);
  const startStr = `${Math.floor(startMonths / 12)}-${String((startMonths % 12) + 1).padStart(2, "0")}-01`;

  const { data: deliveries, error: dErr } = await admin
    .from("deliveries")
    .select("delivery_date, total_value, restaurant_id, status, restaurants(name)")
    .gte("delivery_date", startStr)
    .order("delivery_date", { ascending: true });

  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  // Fetch expenses for the same range
  const { data: expenses } = await admin
    .from("farm_expenses")
    .select("date, amount, category")
    .gte("date", startStr)
    .order("date", { ascending: true });

  // Aggregate by month — shared rollup in lib/reports/aggregate.
  const monthMap = rollupByMonth(
    deliveries ?? [],
    expenses ?? [],
    (d) => (d.restaurants as any)?.name ?? d.restaurant_id,
  );

  const result = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, net_value: m.total_value - m.total_expenses }));

  return NextResponse.json({ months: result });
}
