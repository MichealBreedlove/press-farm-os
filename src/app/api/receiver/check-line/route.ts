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
 * POST /api/receiver/check-line
 *
 * Toggle the received_at timestamp on a single line. Used by the per-line
 * ✓ checkbox on the receiver dashboard.
 *
 * Body: { kind: "order_item" | "delivery_item", id: string, received: boolean }
 *
 * Receivers + admins both allowed (admin can also confirm during testing).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["receiver", "admin"]);
  if (!auth.ok) return auth.response;
  const role = auth.role;

  let body: { kind?: string; id?: string; received?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind;
  const id = body.id;
  const received = Boolean(body.received);

  if (kind !== "order_item" && kind !== "delivery_item") {
    return NextResponse.json({ error: "kind must be 'order_item' or 'delivery_item'" }, { status: 400 });
  }
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const table = kind === "order_item" ? "order_items" : "delivery_items";
  const admin = createAdminClient();

  // Receivers may only touch lines inside the dashboard's ±7-day window —
  // this route runs on the service-role client, so without this check any
  // receiver account could rewrite received-status on historical records.
  // Admins are unrestricted (they use the same route while testing).
  if (role === "receiver") {
    const parentSelect = kind === "order_item"
      ? "id, order:orders(delivery_date)"
      : "id, delivery:deliveries(delivery_date, status)";
    const { data: line } = await (admin as any)
      .from(table)
      .select(parentSelect)
      .eq("id", id)
      .maybeSingle();
    if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });
    const parent = kind === "order_item" ? line.order : line.delivery;
    if (!withinReceiverWindow(parent?.delivery_date)) {
      return NextResponse.json({ error: "Line is outside the receiving window" }, { status: 403 });
    }
    if (kind === "delivery_item" && parent?.status === "finalized") {
      return NextResponse.json({ error: "Delivery is finalized — editing is locked" }, { status: 409 });
    }
  }

  const { error } = await (admin as any)
    .from(table)
    .update({ received_at: received ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, received });
}
