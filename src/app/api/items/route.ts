import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ITEM_CATEGORIES, UNIT_TYPES } from "@/lib/constants";

const VALID_CATEGORIES = ITEM_CATEGORIES.map((c) => c.value);
const VALID_UNITS = UNIT_TYPES.map((u) => u.value);

/**
 * GET /api/items?archived=false
 * Lists all items. Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const showArchived = searchParams.get("archived") === "true";

  const admin = createAdminClient();
  let query = (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, unit_prices, chef_notes, internal_notes, source, is_archived, is_event_item, sort_order")
    .order("category")
    .order("name");

  if (!showArchived) query = query.eq("is_archived", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data });
}

/**
 * POST /api/items
 * Body: { name, category, unit_type, default_price?, chef_notes?, internal_notes?, source? }
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: {
    name: string;
    category: string;
    unit_type: string;
    default_price?: number;
    unit_prices?: Record<string, number>;
    chef_notes?: string;
    internal_notes?: string;
    source?: string;
    is_event_item?: boolean;
    is_press_bar_item?: boolean;
    show_in_regular_menu?: boolean;
    parent_item_id?: string | null;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, category, unit_type, default_price, unit_prices, chef_notes, internal_notes, source } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category as any)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  // unit_type may be a comma-separated list of one or more valid units (e.g. "sm,lg")
  const unitParts = (unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean);
  if (unitParts.length === 0 || unitParts.some((u: string) => !VALID_UNITS.includes(u as any))) {
    return NextResponse.json({ error: "Invalid unit_type" }, { status: 400 });
  }

  // Sanitize unit_prices: only keep numeric entries for currently-selected units
  const cleanedUnitPrices: Record<string, number> = {};
  if (unit_prices && typeof unit_prices === "object") {
    for (const u of unitParts) {
      const v = (unit_prices as any)[u];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) cleanedUnitPrices[u] = v;
    }
  }

  const admin = createAdminClient();
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  // Validate parent_item_id (single-level only): the proposed parent must
  // exist and must not itself be a child of another item.
  let parent_item_id: string | null = null;
  if (body.parent_item_id) {
    const { data: parent } = await (admin as any)
      .from("items")
      .select("id, parent_item_id")
      .eq("id", body.parent_item_id)
      .single();
    if (!parent) return NextResponse.json({ error: "Parent item not found" }, { status: 400 });
    if (parent.parent_item_id) {
      return NextResponse.json({ error: "Parent item is itself a subitem — only one level of nesting is supported" }, { status: 400 });
    }
    parent_item_id = parent.id;
  }

  const { data: item, error } = await (admin as any)
    .from("items")
    .insert({
      farm_id: farm.id,
      name: name.trim(),
      category,
      unit_type: unitParts.join(","),
      default_price: default_price ?? null,
      unit_prices: cleanedUnitPrices,
      chef_notes: chef_notes?.trim() ?? null,
      internal_notes: internal_notes?.trim() ?? null,
      source: source?.trim() ?? null,
      is_event_item: Boolean(body.is_event_item),
      is_press_bar_item: Boolean(body.is_press_bar_item),
      // Default new items to Regular Menu visible — matches the DB
      // column default and the form's checkbox initial state.
      show_in_regular_menu: body.show_in_regular_menu === undefined ? true : Boolean(body.show_in_regular_menu),
      parent_item_id,
      seasonal_months: Array.isArray((body as any).seasonal_months)
        ? Array.from(
            new Set(
              ((body as any).seasonal_months as unknown[])
                .map(Number)
                .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
            ),
          ).sort((a, b) => a - b)
        : [],
    })
    .select("id, name, category, unit_type, default_price, unit_prices, chef_notes, internal_notes, source, is_archived, parent_item_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item }, { status: 201 });
}
