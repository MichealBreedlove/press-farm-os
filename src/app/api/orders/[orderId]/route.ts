import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/orders/[orderId] — Update order status, notes, or fulfillment
 *
 * Used by admin to: close ordering, mark in_progress, mark fulfilled.
 * Used by chef to: update freeform notes.
 *
 * TODO: Implement order update logic
 */
export async function PATCH(
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

  // TODO: Update order by orderId
  void orderId;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
