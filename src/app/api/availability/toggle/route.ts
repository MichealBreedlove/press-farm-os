import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/api-auth";

/**
 * PATCH /api/availability/toggle — Toggle ordering_open on a delivery date (admin only)
 *
 * Body: { delivery_date_id: string, ordering_open: boolean }
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();

  const auth = await requireRole(supabase, ["admin"], { requireActive: true });
  if (!auth.ok) return auth.response;

  let body: { delivery_date_id: string; ordering_open: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { delivery_date_id, ordering_open } = body;
  if (!delivery_date_id || typeof ordering_open !== "boolean") {
    return NextResponse.json({ error: "Missing delivery_date_id or ordering_open" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await (adminClient.from("delivery_dates") as any)
    .update({ ordering_open })
    .eq("id", delivery_date_id)
    .select()
    .single();

  if (error) {
    console.error("Toggle ordering error:", error);
    return NextResponse.json({ error: "Failed to toggle ordering" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
