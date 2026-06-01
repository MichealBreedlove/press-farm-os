import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/availability — Get availability for a date
 * Query: ?date=2026-04-14&restaurant_id=xxx
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const restaurantId = url.searchParams.get("restaurant_id");

  const admin = createAdminClient();
  let query = (admin as any).from("availability_items")
    .select("*, items(name, category, unit_type, size, color)")
    .eq("delivery_date", date);

  if (restaurantId) query = query.eq("restaurant_id", restaurantId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

// The write verb (POST) was removed: /api/v1 is a read-only public API gated by
// a single shared key. Publishing availability and opening ordering must go
// through the authenticated admin routes (/api/availability), not a leakable
// bearer token.

