import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/stats — Dashboard stats overview
 * Query: ?month=2026-03 (defaults to current month)
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const today = new Date().toISOString().split("T")[0];
  const month = url.searchParams.get("month") ?? today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

  const admin = createAdminClient();

  const [
    { count: itemCount },
    { count: pendingOrders },
    { data: deliveries },
    { data: expenses },
    { data: labor },
    { data: restaurants },
  ] = await Promise.all([
    (admin as any).from("items").select("*", { count: "exact", head: true }).eq("is_archived", false),
    (admin as any).from("orders").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    (admin as any).from("deliveries").select("total_value, delivery_date, restaurant_id").gte("delivery_date", monthStart).lte("delivery_date", monthEnd),
    (admin as any).from("farm_expenses").select("amount, category").gte("date", monthStart).lte("date", monthEnd),
    (admin as any).from("labor_entries").select("hours, hourly_rate, worker_name").gte("date", monthStart).lte("date", monthEnd),
    (admin as any).from("restaurants").select("id, name"),
  ]);

  const totalRevenue = (deliveries ?? []).reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);
  const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
  const totalLaborHours = (labor ?? []).reduce((s: number, l: any) => s + (l.hours ?? 0), 0);
  const totalLaborCost = (labor ?? []).reduce((s: number, l: any) => s + (l.hours * (l.hourly_rate ?? 0)), 0);
  const workers = [...new Set((labor ?? []).map((l: any) => l.worker_name))];

  return NextResponse.json({
    month,
    activeItems: itemCount ?? 0,
    pendingOrders: pendingOrders ?? 0,
    restaurants: (restaurants ?? []).map((r: any) => ({ id: r.id, name: r.name })),
    revenue: {
      total: totalRevenue,
      deliveryCount: (deliveries ?? []).length,
    },
    expenses: {
      total: totalExpenses,
      count: (expenses ?? []).length,
      byCategory: (expenses ?? []).reduce((acc: any, e: any) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amount;
        return acc;
      }, {}),
    },
    labor: {
      totalHours: totalLaborHours,
      totalCost: totalLaborCost,
      workers,
    },
    net: totalRevenue - totalExpenses - totalLaborCost,
  });
}
