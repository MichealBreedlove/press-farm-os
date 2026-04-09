import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reports/top-items?start=2026-01-01&end=2026-03-31&limit=10
 * Returns most ordered items by total value from delivery_items.
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
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);

  const admin = createAdminClient();

  // Fetch delivery items with joins
  let query = (admin as any)
    .from("delivery_items")
    .select(`
      item_id, quantity, line_total,
      items ( id, name, category, unit_type ),
      deliveries ( delivery_date )
    `);

  if (start) query = query.gte("deliveries.delivery_date", start);
  if (end) query = query.lte("deliveries.delivery_date", end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by item
  const itemMap: Record<string, {
    item_id: string;
    name: string;
    category: string;
    unit: string;
    total_quantity: number;
    total_value: number;
    order_count: number;
  }> = {};

  for (const di of data ?? []) {
    if (!di.items) continue;
    const id = di.item_id;
    if (!itemMap[id]) {
      itemMap[id] = {
        item_id: id,
        name: di.items.name,
        category: di.items.category,
        unit: di.items.unit_type,
        total_quantity: 0,
        total_value: 0,
        order_count: 0,
      };
    }
    itemMap[id].total_quantity += di.quantity ?? 0;
    itemMap[id].total_value += di.line_total ?? 0;
    itemMap[id].order_count += 1;
  }

  const sorted = Object.values(itemMap)
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, limit);

  return NextResponse.json({ items: sorted });
}
