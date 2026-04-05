import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/availability — Save/publish availability for a delivery date + restaurant
 *
 * Body: { date, restaurantId, items: [{ item_id, status, limited_qty, cycle_notes }], allItemIds }
 *
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  type AvailStatus = "available" | "limited" | "unavailable";
  let body: {
    date: string;
    restaurantId: string;
    items: { item_id: string; status: AvailStatus; limited_qty: number | null; cycle_notes: string | null }[];
    allItemIds: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, restaurantId, items, allItemIds } = body;
  if (!date || !restaurantId || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Build upsert payload: explicit items + default "available" for the rest
  const explicitItemIds = new Set(items.map((i) => i.item_id));
  const defaultItems = (allItemIds ?? [])
    .filter((id) => !explicitItemIds.has(id))
    .map((id) => ({
      item_id: id,
      restaurant_id: restaurantId,
      delivery_date: date,
      status: "available",
      limited_qty: null,
      cycle_notes: null,
    }));

  const explicitRows = items.map((item) => ({
    item_id: item.item_id,
    restaurant_id: restaurantId,
    delivery_date: date,
    status: item.status,
    limited_qty: item.limited_qty,
    cycle_notes: item.cycle_notes,
  }));

  const allRows = [...explicitRows, ...defaultItems];

  if (allRows.length > 0) {
    const { error } = await admin
      .from("availability_items")
      .upsert(allRows, { onConflict: "item_id,restaurant_id,delivery_date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
