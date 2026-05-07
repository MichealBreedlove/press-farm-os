import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "receiver" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const { error } = await (admin as any)
    .from(table)
    .update({ received_at: received ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, received });
}
