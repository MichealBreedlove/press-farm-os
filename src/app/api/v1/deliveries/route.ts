import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/deliveries — List deliveries
 * Query: ?month=2026-03&date=2026-03-14&restaurant=press&limit=50
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const date = url.searchParams.get("date");
  const limit = parseInt(url.searchParams.get("limit") ?? "100");

  const admin = createAdminClient();
  let query = (admin as any).from("deliveries")
    .select("*, restaurants(name), delivery_items(*, items(name, category, unit_type))")
    .order("delivery_date", { ascending: false })
    .limit(limit);

  if (date) query = query.eq("delivery_date", date);
  if (month) {
    query = query.gte("delivery_date", `${month}-01`);
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    query = query.lte("delivery_date", `${month}-${String(lastDay).padStart(2, "0")}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

// Write verbs (POST/DELETE) were removed: /api/v1 is a read-only public API
// gated by a single shared key. Deliveries are the financial source of truth,
// so they must only be created/deleted through the authenticated admin routes
// (/api/deliveries), never a leakable bearer token.

