import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/availability — Get availability for a date
 * Query: ?date=2026-04-14&restaurant_id=xxx
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const restaurantId = url.searchParams.get("restaurant_id");

  const admin = createAdminClient();
  let query = (admin as any).from("availability_items")
    .select("*, items(name, category, unit_type, size, color)")
    .eq("delivery_date", date);

  if (restaurantId) query = query.eq("restaurant_id", restaurantId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

/**
 * POST /api/v1/availability — Publish availability for all restaurants
 * Body: { date, items: [{ item_id, status, limited_qty?, cycle_notes?, available_sizes?, available_colors? }], restaurant_ids?: string[] }
 * If restaurant_ids omitted, applies to all restaurants
 */
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const admin = createAdminClient();

  let restaurantIds = body.restaurant_ids;
  if (!restaurantIds) {
    const { data: restaurants } = await (admin as any).from("restaurants").select("id");
    restaurantIds = (restaurants ?? []).map((r: any) => r.id);
  }

  for (const rid of restaurantIds) {
    const rows = (body.items ?? []).map((item: any) => ({
      item_id: item.item_id,
      restaurant_id: rid,
      delivery_date: body.date,
      status: item.status ?? "available",
      limited_qty: item.limited_qty ?? null,
      cycle_notes: item.cycle_notes ?? null,
      available_sizes: item.available_sizes ?? null,
      available_colors: item.available_colors ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await (admin as any).from("availability_items")
      .upsert(rows, { onConflict: "item_id,restaurant_id,delivery_date", ignoreDuplicates: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Open ordering
  await (admin as any).from("delivery_dates").update({ ordering_open: true }).eq("date", body.date);

  return NextResponse.json({ success: true, restaurants: restaurantIds.length });
}
