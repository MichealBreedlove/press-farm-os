import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/orders/[orderId]/picked
 *
 * Toggle the picked_at timestamp on a single order_item. Used by the
 * pick-list checkbox during harvest. Admin only. The orderId in the
 * URL scopes the auth check — body { order_item_id, picked }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient();
  const { orderId } = await params;

  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { order_item_id?: string; picked?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderItemId = body.order_item_id;
  if (!orderItemId || typeof orderItemId !== "string") {
    return NextResponse.json({ error: "order_item_id required" }, { status: 400 });
  }
  const picked = Boolean(body.picked);

  const admin = createAdminClient();

  // Confirm the order_item belongs to the URL's order so a forged
  // order_item_id can't be flipped outside its scope.
  const { data: row } = await (admin as any)
    .from("order_items")
    .select("id, order_id")
    .eq("id", orderItemId)
    .single();
  if (!row || row.order_id !== orderId) {
    return NextResponse.json({ error: "Order item not found" }, { status: 404 });
  }

  const { error } = await (admin as any)
    .from("order_items")
    .update({ picked_at: picked ? new Date().toISOString() : null })
    .eq("id", orderItemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, picked });
}
