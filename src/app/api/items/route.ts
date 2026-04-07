import { NextResponse } from "next/server";
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const showArchived = searchParams.get("archived") === "true";

  const admin = createAdminClient();
  let query = (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived, sort_order")
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    name: string;
    category: string;
    unit_type: string;
    default_price?: number;
    chef_notes?: string;
    internal_notes?: string;
    source?: string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, category, unit_type, default_price, chef_notes, internal_notes, source } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category as any)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (!VALID_UNITS.includes(unit_type as any)) return NextResponse.json({ error: "Invalid unit_type" }, { status: 400 });

  const admin = createAdminClient();
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  const { data: item, error } = await (admin as any)
    .from("items")
    .insert({
      farm_id: farm.id,
      name: name.trim(),
      category,
      unit_type,
      default_price: default_price ?? null,
      chef_notes: chef_notes?.trim() ?? null,
      internal_notes: internal_notes?.trim() ?? null,
      source: source?.trim() ?? null,
    })
    .select("id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item }, { status: 201 });
}
