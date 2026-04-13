import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/orders — List orders
 * Query: ?date=2026-03-14&status=submitted&limit=50
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") ?? "100");

  const admin = createAdminClient();
  let query = (admin as any).from("orders")
    .select("*, restaurants(name), profiles!orders_chef_id_fkey(full_name), order_items(*, availability_items(item:items(name, category, unit_type)))")
    .order("delivery_date", { ascending: false })
    .limit(limit);

  if (date) query = query.eq("delivery_date", date);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

/**
 * PATCH /api/v1/orders — Update order status
 * Body: { id, status }
 */
export async function PATCH(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any).from("orders").update({ status }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * DELETE /api/v1/orders — Delete an order
 * Body: { id }
 */
export async function DELETE(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await request.json();
  const admin = createAdminClient();
  await (admin as any).from("order_items").delete().eq("order_id", id);
  const { error } = await (admin as any).from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
