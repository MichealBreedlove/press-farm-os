import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crop_plan_entries")
    .select("*")
    .order("item_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { farm_id, item_name, category, season, notes } = body;

  if (!item_name || !category || !season)
    return NextResponse.json({ error: "item_name, category, season required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crop_plan_entries")
    .insert({ farm_id, item_name, category, season, notes: notes || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { id } = await request.json();
  const admin = createAdminClient();
  const { error } = await admin.from("crop_plan_entries").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
