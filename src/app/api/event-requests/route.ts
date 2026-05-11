import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

interface ItemLine {
  item_id?: string;
  quantity?: number;
  unit?: string;
}

interface CreateRequestBody {
  items?: ItemLine[];
  needed_by_date?: string;
  event_name?: string | null;
  notes?: string | null;

  // Legacy single-item shape, still accepted for back-compat with any
  // direct callers from before the multi-line UI shipped.
  item_id?: string;
  quantity?: number;
  unit?: string;
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
      "id, restaurant_id, chef_id, item_id, quantity, unit, needed_by_date, event_name, notes, status, admin_response, responded_at, responded_by, order_item_id, event_group_id, created_at, updated_at, restaurant:restaurants(id, name), chef:profiles!event_requests_chef_id_fkey(id, full_name), item:items(id, name, category, unit_type)",
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
 * Files one or more item requests under a single event (shared
 * needed_by_date + event_name + notes). All rows share an event_group_id
 * so the admin queue can present them together and accept/decline as a
 * batch. Returns { group_id, count } so the UI can land on a confirmation
 * page or list filtered to the group.
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

  // Accept either the batch shape or the legacy single-item shape.
  const rawLines: ItemLine[] = Array.isArray(body.items) && body.items.length > 0
    ? body.items
    : [{ item_id: body.item_id, quantity: body.quantity, unit: body.unit }];

  const neededBy = body.needed_by_date?.trim();
  const eventName = body.event_name?.trim() || null;
  const notes = body.notes?.trim() || null;

  if (!neededBy) return NextResponse.json({ error: "needed_by_date required" }, { status: 400 });
  const today = new Date().toISOString().split("T")[0];
  if (neededBy < today) {
    return NextResponse.json({ error: "needed_by_date must be today or later" }, { status: 400 });
  }

  // Validate every line before any insert so a bad row doesn't get past
  // validation after some rows have already landed in the database.
  const lines: { item_id: string; quantity: number; unit: string }[] = [];
  for (const [i, raw] of rawLines.entries()) {
    const itemId = raw.item_id?.trim();
    const quantity = Number(raw.quantity);
    const unit = raw.unit?.trim();
    if (!itemId) return NextResponse.json({ error: `line ${i + 1}: item_id required` }, { status: 400 });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: `line ${i + 1}: quantity must be > 0` }, { status: 400 });
    }
    if (!unit) return NextResponse.json({ error: `line ${i + 1}: unit required` }, { status: 400 });
    lines.push({ item_id: itemId, quantity, unit });
  }
  if (lines.length === 0) {
    return NextResponse.json({ error: "At least one item required" }, { status: 400 });
  }

  // Resolve the chef's restaurant. None of the current shared accounts
  // are multi-restaurant; the first link wins.
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

  // Validate all referenced items in one query.
  const itemIds = [...new Set(lines.map((l) => l.item_id))];
  const { data: itemRows } = await (admin as any)
    .from("items")
    .select("id, is_archived")
    .in("id", itemIds);
  const itemMap = new Map<string, { is_archived: boolean }>(
    (itemRows ?? []).map((r: any) => [r.id, { is_archived: !!r.is_archived }]),
  );
  for (const line of lines) {
    const found = itemMap.get(line.item_id);
    if (!found || found.is_archived) {
      return NextResponse.json({ error: "Item not found or archived" }, { status: 400 });
    }
  }

  // Single shared group_id stitches all rows for the same submission.
  const groupId = randomUUID();
  const rowsToInsert = lines.map((l) => ({
    restaurant_id: restaurantId,
    chef_id: user.id,
    item_id: l.item_id,
    quantity: l.quantity,
    unit: l.unit,
    needed_by_date: neededBy,
    event_name: eventName,
    notes,
    event_group_id: groupId,
  }));

  const { error } = await (admin as any).from("event_requests").insert(rowsToInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ group_id: groupId, count: rowsToInsert.length });
}
