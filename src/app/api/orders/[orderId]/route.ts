import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";

/**
 * PATCH /api/orders/[orderId] — Update order status (admin only)
 *
 * Body: { status: OrderStatus }
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

  // Verify admin
  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profileRaw || profileRaw.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status: OrderStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status } = body;
  const validStatuses: OrderStatus[] = ["draft", "submitted", "in_progress", "fulfilled", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: order, error } = await (adminClient.from("orders") as any)
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !order) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }

  return NextResponse.json({ data: order, error: null });
}
