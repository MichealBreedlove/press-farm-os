import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SETTINGS_KEYS = new Set([
  // Settings → Email Settings
  "email_admin",
  "email_order_notifications",
  "email_availability_updates",
  "email_receiver",
  "email_labor_report",
  "email_partner_report",
  "email_partner_name",
  "weekly_digest_recipients",
  // /admin/weekly-update
  "weekly_update_general_note",
  "weekly_update_recipients",
  "weekly_update_draft",
  "weekly_update_postponed_week",
  "weekly_update_send_after",
]);

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

  let body: { settings?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const settings = body?.settings;
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "settings object required" }, { status: 400 });
  }

  // Single-tenant: resolve the farm server-side instead of trusting the body.
  const admin = createAdminClient();
  const { data: farm } = await admin.from("farms").select("id").limit(1).maybeSingle();
  if (!farm?.id) return NextResponse.json({ error: "Farm not seeded" }, { status: 500 });

  // Only the keys the Settings + Weekly Update pages edit. The cron STAMPS
  // (`*_last_sent_week`, `weekly_update_alert_sent_week`) are written by the
  // send routes themselves and are deliberately not settable from here.
  const unknown = Object.keys(settings).filter((k) => !SETTINGS_KEYS.has(k));
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown setting: ${unknown[0]}` }, { status: 400 });
  }

  for (const [key, value] of Object.entries(settings)) {
    const { error } = await admin.from("farm_settings").upsert(
      { farm_id: farm.id, key, value: typeof value === "string" && value ? value.slice(0, 5000) : null },
      { onConflict: "farm_id,key" },
    );
    if (error) {
      console.error("[settings] upsert failed:", key, error);
      return NextResponse.json({ error: `Could not save ${key}` }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
