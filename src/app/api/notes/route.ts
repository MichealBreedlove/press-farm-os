import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/notes — List all farm notes (admin only)
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("farm_notes")
    .select("*")
    .order("date", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * POST /api/notes — Create a farm note (admin only)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { date, text, category } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id;
  if (!farmId) return NextResponse.json({ error: "No farm found" }, { status: 500 });

  const { data, error } = await admin.from("farm_notes").insert({
    farm_id: farmId,
    date: date || new Date().toISOString().split("T")[0],
    text: text.trim(),
    category: category || "observation",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
