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
  let query = admin.from("orders")
    .select("*, restaurants(name), profiles!orders_chef_id_fkey(full_name), order_items(*, availability_items(item:items(name, category, unit_type)))")
    .order("delivery_date", { ascending: false })
    .limit(limit);

  if (date) query = query.eq("delivery_date", date);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

// Write verbs (PATCH/DELETE) were removed: /api/v1 is a read-only public API
// gated by a single shared key. Order status changes and deletions must go
// through the authenticated admin/chef routes (/api/orders), not a leakable
// bearer token.

