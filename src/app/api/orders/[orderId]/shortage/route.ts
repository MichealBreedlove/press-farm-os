import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/orders/[orderId]/shortage — Mark order items as shorted
 *
 * Body: { shortages: [{ order_item_id, quantity_fulfilled, shortage_reason }] }
 *
 * Updates order_items. Sends shortage email to chef via Resend.
 * Admin only.
 *
 * TODO: Implement shortage logic + notification
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const supabase = await createClient();
  const { orderId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Verify admin, update order_items, send shortage notification
  void orderId;
  const _adminClient = createAdminClient(); // will be used for notifications
  void _adminClient;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
