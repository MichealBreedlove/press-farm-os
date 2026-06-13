import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/api-auth";
import { todayPacific } from "@/lib/utils";

/** Receiver dashboard date-picker window: ±7 days around farm-local today. */
function withinReceiverWindow(deliveryDate: string | null | undefined): boolean {
  if (!deliveryDate) return false;
  const today = todayPacific();
  const t = new Date(today + "T12:00:00").getTime();
  const d = new Date(deliveryDate + "T12:00:00").getTime();
  if (!Number.isFinite(d)) return false;
  return Math.abs(d - t) <= 7 * 86400000;
}

/**
 * POST /api/receiver/close-delivery
 *
 * Close out a delivery for accountability — sets closed_at + closed_by_name
 * on the delivery row, flips status to 'finalized', locking edits. Body
 * { delivery_id, closed_by_name }. Receivers + admins.
 *
 * Idempotent — re-closing updates the timestamp + name (e.g. if a typo).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["receiver", "admin"]);
  if (!auth.ok) return auth.response;
  const role = auth.role;

  let body: { delivery_id?: string; closed_by_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deliveryId = (body.delivery_id ?? "").trim();
  const closedByName = (body.closed_by_name ?? "").trim();

  if (!deliveryId) {
    return NextResponse.json({ error: "delivery_id required" }, { status: 400 });
  }
  if (!closedByName) {
    return NextResponse.json(
      { error: "closed_by_name required — type your name to close out" },
      { status: 400 },
    );
  }
  if (closedByName.length > 100) {
    return NextResponse.json({ error: "closed_by_name too long (max 100)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Receivers may only close deliveries inside the dashboard's ±7-day
  // window — service-role client below bypasses RLS, so without this any
  // receiver could finalize (lock) historical financial records.
  // Admins are unrestricted.
  if (role === "receiver") {
    const { data: delivery } = await (admin as any)
      .from("deliveries")
      .select("id, delivery_date")
      .eq("id", deliveryId)
      .maybeSingle();
    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    if (!withinReceiverWindow(delivery.delivery_date)) {
      return NextResponse.json({ error: "Delivery is outside the receiving window" }, { status: 403 });
    }
  }

  const { error } = await (admin as any)
    .from("deliveries")
    .update({
      closed_at: new Date().toISOString(),
      closed_by_name: closedByName,
      status: "finalized",
    })
    .eq("id", deliveryId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, closed_by_name: closedByName });
}
