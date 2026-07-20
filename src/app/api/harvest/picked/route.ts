import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/api-auth";

/**
 * POST /api/harvest/picked
 * Body: { date: "YYYY-MM-DD", line_ids: string[], picked: boolean }
 *
 * Bulk pick-toggle for the harvester portal. A /harvest grid row aggregates
 * order_items across every restaurant (and regular + events lines), so
 * marking a crop "harvested" flips picked_at on all its contributing lines
 * at once — the same field the admin pick list uses, so progress shows up
 * live on /admin/orders/[date] too.
 *
 * The date scopes the write: only lines whose order is on that delivery
 * date are touched, so a forged id can't flip historical orders.
 *
 * Admin + harvester.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["admin", "harvester"], { requireActive: true });
  if (!auth.ok) return auth.response;

  let body: { date?: string; line_ids?: unknown; picked?: boolean };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) required" }, { status: 400 });
  }
  const lineIds = body.line_ids;
  if (
    !Array.isArray(lineIds) ||
    lineIds.length === 0 ||
    lineIds.length > 500 ||
    !lineIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return NextResponse.json({ error: "line_ids must be 1–500 ids" }, { status: 400 });
  }
  const picked = Boolean(body.picked);

  const admin = createAdminClient();

  // Resolve which of the requested lines actually belong to orders on this
  // delivery date; only those get flipped.
  const { data: validRows, error: lookupErr } = await (admin as any)
    .from("order_items")
    .select("id, order:orders!inner(delivery_date)")
    .in("id", lineIds)
    .eq("order.delivery_date", date);
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  const validIds = (validRows ?? []).map((r: any) => r.id);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "No matching lines for this date" }, { status: 404 });
  }

  const { data: updated, error } = await (admin as any)
    .from("order_items")
    .update({ picked_at: picked ? new Date().toISOString() : null })
    .in("id", validIds)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ updated: (updated ?? []).length, picked });
}
