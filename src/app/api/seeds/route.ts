import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_STATUSES } from "@/lib/constants";

const VALID_STATUSES = new Set<string>(SEED_STATUSES);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * GET /api/seeds?status=active&item_id=...
 * Returns seeds enriched with item name + on_hand computed column.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const itemIdFilter = searchParams.get("item_id");

  const admin = createAdminClient();
  let query = (admin as any)
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .order("variety");

  if (statusFilter && VALID_STATUSES.has(statusFilter)) query = query.eq("status", statusFilter);
  if (itemIdFilter) query = query.eq("item_id", itemIdFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seeds: data ?? [] });
}

/**
 * POST /api/seeds
 * Body: { item_id, variety, initial_quantity, quantity_unit, packed_for_year?, purchase_date?, supplier?, cost?, status?, notes? }
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const item_id = String(body.item_id ?? "").trim();
  const variety = String(body.variety ?? "").trim();
  const quantity_unit = String(body.quantity_unit ?? "").trim();
  const initial_quantity_raw = body.initial_quantity;

  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!variety) return NextResponse.json({ error: "variety required" }, { status: 400 });
  if (!quantity_unit) return NextResponse.json({ error: "quantity_unit required" }, { status: 400 });

  const initial_quantity = typeof initial_quantity_raw === "number"
    ? initial_quantity_raw
    : parseFloat(String(initial_quantity_raw));
  if (!Number.isFinite(initial_quantity) || initial_quantity < 0) {
    return NextResponse.json({ error: "initial_quantity must be a non-negative number" }, { status: 400 });
  }

  const status = body.status ? String(body.status) : "active";
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  // Validate item exists
  const { data: item } = await (admin as any).from("items").select("id").eq("id", item_id).single();
  if (!item) return NextResponse.json({ error: "item_id does not match any item" }, { status: 400 });

  const insertRow: Record<string, unknown> = {
    farm_id: farm.id,
    item_id,
    variety,
    initial_quantity,
    quantity_unit,
    status,
    packed_for_year: body.packed_for_year != null ? Number(body.packed_for_year) : null,
    purchase_date: body.purchase_date ? String(body.purchase_date) : null,
    supplier: body.supplier ? String(body.supplier).trim() : null,
    cost: body.cost != null ? Number(body.cost) : null,
    notes: body.notes ? String(body.notes).trim() : null,
  };

  const { data: seed, error } = await (admin as any)
    .from("seeds")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seed }, { status: 201 });
}
