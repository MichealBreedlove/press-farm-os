import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function cropForTray(admin: any, trayId: string) {
  const { data: tray } = await admin
    .from("microgreen_trays").select("*").eq("id", trayId).maybeSingle();
  if (!tray) return { tray: null, crop: null };
  const { data: batch } = await admin
    .from("microgreen_batches").select("crop_id").eq("id", tray.batch_id).maybeSingle();
  const { data: crop } = batch
    ? await admin.from("microgreen_crops").select("*").eq("id", batch.crop_id).maybeSingle()
    : { data: null };
  return { tray, crop };
}

// Preview a distribution: how many deliveries exist in ?month=YYYY-MM for the
// crop's farm. The dialog divides the value by this count client-side.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { tray, crop } = await cropForTray(admin as any, params.id);
  if (!tray) return NextResponse.json({ error: "Tray not found" }, { status: 404 });
  if (!crop) return NextResponse.json({ error: "Crop not found for tray" }, { status: 404 });

  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const { count, error } = await (admin as any)
    .from("deliveries")
    .select("id, restaurant:restaurants!inner(farm_id)", { count: "exact", head: true })
    .eq("restaurant.farm_id", crop.farm_id)
    .gte("delivery_date", monthStart)
    .lt("delivery_date", nextMonth);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ month, deliveries_count: count ?? 0 });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { lost, lost_reason, distribute, target_month, value } = body;
  if (lost && !lost_reason) {
    return NextResponse.json({ error: "lost_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Continuous-harvest path: terminate AND spread the tray's value across all
  // of the target month's deliveries in one transaction (RPC). The RPC
  // validates crop/item/value and refuses double-distribution.
  if (distribute) {
    if (typeof target_month !== "string" || !MONTH_RE.test(target_month)) {
      return NextResponse.json({ error: "target_month must be YYYY-MM" }, { status: 400 });
    }
    if (value != null && (typeof value !== "number" || !(value > 0))) {
      return NextResponse.json({ error: "value must be a positive number" }, { status: 400 });
    }
    const { data: summary, error } = await (admin as any).rpc(
      "terminate_tray_and_distribute",
      {
        p_tray_id: params.id,
        p_target_month: `${target_month}-01`,
        p_value_override: value ?? null,
      },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ summary });
  }

  const status = lost ? "lost" : "terminated";
  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update({
      status,
      terminated_at: new Date().toISOString(),
      lost_reason: lost ? lost_reason : null,
    })
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tray: data });
}

// Undo a distribution: removes the tray's distributed line items (delivery
// totals recalc via trigger). The tray stays terminated and can be
// re-distributed afterwards.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: removed, error } = await (admin as any).rpc("undo_tray_distribution", {
    p_tray_id: params.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ removed: removed ?? 0 });
}
