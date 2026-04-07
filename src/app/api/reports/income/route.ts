import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reports/income?year=2026&quarter=1
 * Returns quarterly income statement: delivery value, expenses by category, net margin.
 * Benchmark: Q1 2026 = $21,633 value / $1,536 expenses / $12K farmer pay.
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const quarter = parseInt(searchParams.get("quarter") ?? "1");

  if (quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: "quarter must be 1–4" }, { status: 400 });
  }

  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const end = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const admin = createAdminClient();

  const [{ data: deliveries }, { data: expenses }] = await Promise.all([
    (admin as any)
      .from("deliveries")
      .select("delivery_date, total_value, restaurants(name)")
      .gte("delivery_date", start)
      .lte("delivery_date", end),
    (admin as any)
      .from("farm_expenses")
      .select("date, amount, category")
      .gte("date", start)
      .lte("date", end),
  ]);

  // Monthly breakdown
  const monthMap: Record<string, { month: string; revenue: number; expenses: number }> = {};
  for (let m = startMonth; m <= endMonth; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    monthMap[key] = { month: key, revenue: 0, expenses: 0 };
  }
  for (const d of deliveries ?? []) {
    const m = d.delivery_date.slice(0, 7);
    if (monthMap[m]) monthMap[m].revenue += d.total_value ?? 0;
  }
  for (const e of expenses ?? []) {
    const m = e.date.slice(0, 7);
    if (monthMap[m]) monthMap[m].expenses += e.amount ?? 0;
  }

  // By restaurant
  const byRestaurant: Record<string, number> = {};
  for (const d of deliveries ?? []) {
    const name = (d.restaurants as any)?.name ?? "Unknown";
    byRestaurant[name] = (byRestaurant[name] ?? 0) + (d.total_value ?? 0);
  }

  // Expenses by category
  const byExpenseCategory: Record<string, number> = {};
  for (const e of expenses ?? []) {
    byExpenseCategory[e.category] = (byExpenseCategory[e.category] ?? 0) + e.amount;
  }

  const totalRevenue = (deliveries ?? []).reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);
  const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);

  return NextResponse.json({
    year,
    quarter,
    period: { start, end },
    totalRevenue,
    totalExpenses,
    netMargin: totalRevenue - totalExpenses,
    marginPercent: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    byMonth: Object.values(monthMap),
    byRestaurant,
    byExpenseCategory,
  });
}
