import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/availability/duplicate — Copy previous cycle's availability to a new date
 *
 * Body: { date, restaurantId }
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

  let body: { date: string; restaurantId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, restaurantId } = body;
  if (!date || !restaurantId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Find the most recent previous availability for this restaurant
  const { data: lastAvail } = await admin
    .from("availability_items")
    .select("item_id, status, limited_qty, cycle_notes")
    .eq("restaurant_id", restaurantId)
    .lt("delivery_date", date)
    .order("delivery_date", { ascending: false });

  if (!lastAvail?.length) {
    return NextResponse.json({ error: "No previous availability found" }, { status: 404 });
  }

  // Use only the most recent date's items
  const { data: lastDate } = await admin
    .from("availability_items")
    .select("delivery_date")
    .eq("restaurant_id", restaurantId)
    .lt("delivery_date", date)
    .order("delivery_date", { ascending: false })
    .limit(1)
    .single();

  const { data: lastCycle } = await admin
    .from("availability_items")
    .select("item_id, status, limited_qty, cycle_notes")
    .eq("restaurant_id", restaurantId)
    .eq("delivery_date", lastDate!.delivery_date);

  if (!lastCycle?.length) {
    return NextResponse.json({ error: "No previous availability found" }, { status: 404 });
  }

  const newRows = lastCycle.map((row) => ({
    item_id: row.item_id,
    restaurant_id: restaurantId,
    delivery_date: date,
    status: row.status,
    limited_qty: row.limited_qty,
    cycle_notes: row.cycle_notes,
  }));

  const { error } = await admin
    .from("availability_items")
    .upsert(newRows, { onConflict: "item_id,restaurant_id,delivery_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the new availability
  const { data: availability } = await admin
    .from("availability_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("delivery_date", date);

  return NextResponse.json({ availability });
}
