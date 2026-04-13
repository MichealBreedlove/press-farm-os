import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/items — List all items
 * Query: ?category=flowers&archived=true&search=nasturtium
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const archived = url.searchParams.get("archived") === "true";
  const search = url.searchParams.get("search");

  const admin = createAdminClient();
  let query = (admin as any).from("items").select("*").order("name");

  if (!archived) query = query.eq("is_archived", false);
  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

/**
 * POST /api/v1/items — Create an item
 * Body: { name, category, unit_type, default_price?, ... }
 */
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const admin = createAdminClient();

  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id;
  if (!farmId) return NextResponse.json({ error: "No farm found" }, { status: 500 });

  const { data, error } = await (admin as any).from("items").insert({
    farm_id: farmId,
    name: body.name,
    category: body.category ?? "fruit_veg",
    unit_type: body.unit_type ?? "ea",
    default_price: body.default_price ?? null,
    chef_notes: body.chef_notes ?? null,
    internal_notes: body.internal_notes ?? null,
    image_url: body.image_url ?? null,
    size: body.size ?? null,
    variety: body.variety ?? null,
    color: body.color ?? null,
    season_status: body.season_status ?? null,
    season_note: body.season_note ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * PATCH /api/v1/items — Update an item
 * Body: { id, ...fields }
 */
export async function PATCH(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any).from("items").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * DELETE /api/v1/items — Delete (archive) an item
 * Body: { id, hard?: boolean }
 */
export async function DELETE(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const admin = createAdminClient();

  if (body.hard) {
    const { error } = await (admin as any).from("items").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await (admin as any).from("items").update({ is_archived: true }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
