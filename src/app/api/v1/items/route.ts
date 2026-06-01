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

// Write verbs (POST/PATCH/DELETE) were removed: /api/v1 is a read-only public
// API gated by a single shared key, and item mutations must go through the
// authenticated admin routes (/api/items), not a leakable bearer token.

