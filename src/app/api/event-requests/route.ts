import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CreateRequestBody {
  item_id?: string;
  quantity?: number;
  unit?: string;
  needed_by_date?: string;
  event_name?: string | null;
  notes?: string | null;
}

/**
 * GET /api/event-requests?status=pending
 *
 * Admin sees all; chef sees only their restaurant's. Joined with item +
 * chef + restaurant for the list views.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const admin = createAdminClient();
  let query = (admin as any)
    .from("event_requests")
    .select(
      "id, restaurant_id, chef_id, item_id, quantity, unit, needed_by_date, event_name, notes, status, admin_response, responded_at, responded_by, order_item_id, created_at, updated_at, restaurant:restaurants(id, name), chef:profiles!event_requests_chef_id_fkey(id, full_name), item:items(id, name, category, unit_type)",
    )
    .order("needed_by_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  // Scope non-admin callers to their own restaurants
  if (profile?.role !== "admin") {
    const { data: links } = await (supabase as any)
      .from("restaurant_users")
      .select("restaurant_id")
      .eq("user_id", user.id);
    const restaurantIds = (links ?? []).map((l: any) => l.restaurant_id);
    if (restaurantIds.length === 0) {
      return NextResponse.json({ requests: [] });
    }
    query = query.in("restaurant_id", restaurantIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

/**
 * POST /api/event-requests
 *
 * Chef files a new request for an item at a future date. Admin can also
 * file on behalf of a chef but this is normally the chef portal endpoint.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = body.item_id?.trim();
  const quantity = Number(body.quantity);
  const unit = body.unit?.trim();
  const neededBy = body.needed_by_date?.trim();
  const eventName = body.event_name?.trim() || null;
  const notes = body.notes?.trim() || null;

  if (!itemId) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!quantity || quantity <= 0) return NextResponse.json({ error: "quantity must be > 0" }, { status: 400 });
  if (!unit) return NextResponse.json({ error: "unit required" }, { status: 400 });
  if (!neededBy) return NextResponse.json({ error: "needed_by_date required" }, { status: 400 });

  // Reject past dates — admin can still file backdated via direct DB if ever needed.
  const today = new Date().toISOString().split("T")[0];
  if (neededBy < today) {
    return NextResponse.json({ error: "needed_by_date must be today or later" }, { status: 400 });
  }

  // Resolve the chef's restaurant. If the user belongs to multiple, prefer the
  // one the request body specifies; else pick the first link.
  const { data: links } = await (supabase as any)
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", user.id);
  const restaurantIds: string[] = (links ?? []).map((l: any) => l.restaurant_id);
  if (restaurantIds.length === 0) {
    return NextResponse.json({ error: "No restaurant assigned to your account" }, { status: 400 });
  }
  const restaurantId = restaurantIds[0];

  const admin = createAdminClient();
  // Validate the item exists and isn't archived
  const { data: item } = await (admin as any)
    .from("items")
    .select("id, is_archived")
    .eq("id", itemId)
    .single();
  if (!item || item.is_archived) {
    return NextResponse.json({ error: "Item not found or archived" }, { status: 400 });
  }

  const { data: inserted, error } = await (admin as any)
    .from("event_requests")
    .insert({
      restaurant_id: restaurantId,
      chef_id: user.id,
      item_id: itemId,
      quantity,
      unit,
      needed_by_date: neededBy,
      event_name: eventName,
      notes,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: inserted.id });
}
