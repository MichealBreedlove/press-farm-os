import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ITEM_CATEGORIES, UNIT_TYPES } from "@/lib/constants";

const VALID_CATEGORIES = ITEM_CATEGORIES.map((c) => c.value);
const VALID_UNITS = UNIT_TYPES.map((u) => u.value);

type Params = Promise<{ itemId: string }>;

/**
 * GET /api/items/[itemId]
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;
  const admin = createAdminClient();

  const { data: item, error } = await (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived, sort_order")
    .eq("id", itemId)
    .single();

  if (error || !item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

/**
 * PATCH /api/items/[itemId]
 * Body: any subset of { name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived }
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { itemId } = await params;

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    updates.name = name;
  }
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.includes(body.category as any)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    updates.category = body.category;
  }
  if (body.unit_type !== undefined) {
    if (!VALID_UNITS.includes(body.unit_type as any)) return NextResponse.json({ error: "Invalid unit_type" }, { status: 400 });
    updates.unit_type = body.unit_type;
  }
  if (body.default_price !== undefined) updates.default_price = body.default_price === null ? null : Number(body.default_price);
  if (body.chef_notes !== undefined) updates.chef_notes = body.chef_notes || null;
  if (body.internal_notes !== undefined) updates.internal_notes = body.internal_notes || null;
  if (body.source !== undefined) updates.source = body.source || null;
  if (body.is_archived !== undefined) updates.is_archived = Boolean(body.is_archived);
  if (body.image_url !== undefined) updates.image_url = body.image_url || null;
  if (body.season_status !== undefined) updates.season_status = body.season_status || "available";
  if (body.season_note !== undefined) updates.season_note = body.season_note || null;
  if (body.days_to_maturity !== undefined) updates.days_to_maturity = body.days_to_maturity;
  if (body.sow_depth !== undefined) updates.sow_depth = body.sow_depth || null;
  if (body.plant_spacing !== undefined) updates.plant_spacing = body.plant_spacing || null;
  if (body.sun_requirement !== undefined) updates.sun_requirement = body.sun_requirement || null;
  if (body.sow_method !== undefined) updates.sow_method = body.sow_method || null;
  if (body.indoor_start_weeks !== undefined) updates.indoor_start_weeks = body.indoor_start_weeks;
  if (body.growing_notes !== undefined) updates.growing_notes = body.growing_notes || null;
  if (body.size !== undefined) updates.size = body.size || null;
  if (body.variety !== undefined) updates.variety = body.variety || null;
  if (body.color !== undefined) updates.color = body.color || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: item, error } = await (admin as any)
    .from("items")
    .update(updates)
    .eq("id", itemId)
    .select("id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}
