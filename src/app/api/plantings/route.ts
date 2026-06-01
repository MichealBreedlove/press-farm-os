import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const season = url.searchParams.get("season") ?? new Date().getFullYear().toString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plantings")
    .select("*, items(name, image_url, category, unit_type)")
    .eq("season", parseInt(season))
    .order("crop_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plantings")
    .insert(body)
    .select()
    .single();

  // NOTE: a former block here auto-inserted into `planting_tasks` — that table
  // was dropped in migration 062 (superseded by farm_tasks), so the insert had
  // been silently failing. Removed. Re-add against farm_tasks if planting-driven
  // task generation is wanted again.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
