import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data } = await admin.from("farm_settings").select("key, value");
  const settings: Record<string, string | null> = {};
  for (const row of data ?? []) settings[row.key] = row.value;
  return NextResponse.json({ data: settings });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { settings, farm_id } = body;

  const admin = createAdminClient();
  for (const [key, value] of Object.entries(settings as Record<string, string>)) {
    await admin.from("farm_settings").upsert(
      { farm_id, key, value: value || null },
      { onConflict: "farm_id,key" }
    );
  }

  return NextResponse.json({ success: true });
}
