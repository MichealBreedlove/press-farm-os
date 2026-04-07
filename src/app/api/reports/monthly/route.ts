import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reports/monthly?months=12
 * Returns monthly delivery totals + expenses for the last N months.
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const months = Math.min(parseInt(searchParams.get("months") ?? "12"), 24);

  const admin = createAdminClient();

  // Fetch deliveries for the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  const startStr = startDate.toISOString().slice(0, 10);

  const { data: deliveries, error: dErr } = await (admin as any)
    .from("deliveries")
    .select("delivery_date, total_value, restaurant_id, status, restaurants(name)")
    .gte("delivery_date", startStr)
    .order("delivery_date", { ascending: true });

  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  // Fetch expenses for the same range
  const { data: expenses } = await (admin as any)
    .from("farm_expenses")
    .select("expense_date, amount, category")
    .gte("expense_date", startStr)
    .order("expense_date", { ascending: true });

  // Aggregate by month
  const monthMap: Record<string, {
    month: string;
    total_value: number;
    total_expenses: number;
    net_value: number;
    by_restaurant: Record<string, number>;
  }> = {};

  for (const d of deliveries ?? []) {
    const m = d.delivery_date.slice(0, 7);
    if (!monthMap[m]) {
      monthMap[m] = { month: m, total_value: 0, total_expenses: 0, net_value: 0, by_restaurant: {} };
    }
    monthMap[m].total_value += d.total_value ?? 0;
    const rName = (d.restaurants as any)?.name ?? d.restaurant_id;
    monthMap[m].by_restaurant[rName] = (monthMap[m].by_restaurant[rName] ?? 0) + (d.total_value ?? 0);
  }

  for (const e of expenses ?? []) {
    const m = e.expense_date.slice(0, 7);
    if (!monthMap[m]) {
      monthMap[m] = { month: m, total_value: 0, total_expenses: 0, net_value: 0, by_restaurant: {} };
    }
    monthMap[m].total_expenses += e.amount ?? 0;
  }

  const result = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, net_value: m.total_value - m.total_expenses }));

  return NextResponse.json({ months: result });
}
