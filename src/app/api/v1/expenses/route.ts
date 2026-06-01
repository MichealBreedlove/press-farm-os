import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/expenses — List expenses
 * Query: ?month=2026-03&category=Seeds&limit=100
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const category = url.searchParams.get("category");

  const admin = createAdminClient();
  let query = admin.from("farm_expenses").select("*").order("date", { ascending: false });

  if (month) {
    query = query.gte("date", `${month}-01`);
    const [y, m] = month.split("-").map(Number);
    query = query.lte("date", `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`);
  }
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

// Write verbs (POST/DELETE) were removed: /api/v1 is a read-only public API
// gated by a single shared key. Expenses feed financial reports, so they must
// only be created/deleted through the authenticated admin routes
// (/api/expenses), never a leakable bearer token.

