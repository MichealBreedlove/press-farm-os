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
    .select("id, name, category, unit_type, default_price, unit_prices, chef_notes, internal_notes, source, is_archived, is_event_item, is_press_bar_item, show_in_regular_menu, sort_order")
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
    // Accept comma-separated list of one or more valid units (e.g. "sm,lg")
    const parts = String(body.unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean);
    if (parts.length === 0 || parts.some((u: string) => !VALID_UNITS.includes(u as any))) {
      return NextResponse.json({ error: "Invalid unit_type" }, { status: 400 });
    }
    updates.unit_type = parts.join(",");
  }
  if (body.default_price !== undefined) updates.default_price = body.default_price === null ? null : Number(body.default_price);
  if (body.unit_prices !== undefined) {
    const cleaned: Record<string, number> = {};
    if (body.unit_prices && typeof body.unit_prices === "object") {
      // Only keep numeric, non-negative entries; drop any unit codes outside VALID_UNITS
      for (const [k, v] of Object.entries(body.unit_prices as Record<string, unknown>)) {
        if (!VALID_UNITS.includes(k as any)) continue;
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (Number.isFinite(n) && n >= 0) cleaned[k] = n;
      }
    }
    updates.unit_prices = cleaned;
  }
  if (body.chef_notes !== undefined) updates.chef_notes = body.chef_notes || null;
  if (body.internal_notes !== undefined) updates.internal_notes = body.internal_notes || null;
  if (body.source !== undefined) updates.source = body.source || null;
  if (body.is_archived !== undefined) updates.is_archived = Boolean(body.is_archived);
  if (body.is_event_item !== undefined) updates.is_event_item = Boolean(body.is_event_item);
  // Independent menu flags from migration 028 + 030. Without these
  // whitelisted, the form silently dropped them and the new
  // checkbox UI looked broken because saves were no-ops.
  if (body.is_press_bar_item !== undefined) updates.is_press_bar_item = Boolean(body.is_press_bar_item);
  if (body.show_in_regular_menu !== undefined) updates.show_in_regular_menu = Boolean(body.show_in_regular_menu);
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

  const admin = createAdminClient();

  // Single-level parent/child rules (admin organization only). Reject:
  //   • parent === self
  //   • parent already has a parent (would create grandchildren)
  //   • this item already has children (it can't itself become a child)
  if (body.parent_item_id !== undefined) {
    if (body.parent_item_id === null || body.parent_item_id === "") {
      updates.parent_item_id = null;
    } else {
      const proposed = String(body.parent_item_id);
      if (proposed === itemId) {
        return NextResponse.json({ error: "Item cannot be its own parent" }, { status: 400 });
      }
      const { data: parent } = await (admin as any)
        .from("items")
        .select("id, parent_item_id")
        .eq("id", proposed)
        .single();
      if (!parent) return NextResponse.json({ error: "Parent item not found" }, { status: 400 });
      if (parent.parent_item_id) {
        return NextResponse.json({ error: "Parent item is itself a subitem — only one level of nesting is supported" }, { status: 400 });
      }
      const { count: childCount } = await (admin as any)
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("parent_item_id", itemId);
      if ((childCount ?? 0) > 0) {
        return NextResponse.json({ error: "This item has subitems and cannot itself become a subitem" }, { status: 400 });
      }
      updates.parent_item_id = proposed;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: item, error } = await (admin as any)
    .from("items")
    .update(updates)
    .eq("id", itemId)
    .select("id, name, category, unit_type, default_price, unit_prices, chef_notes, internal_notes, source, is_archived, is_event_item, is_press_bar_item, show_in_regular_menu")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}
