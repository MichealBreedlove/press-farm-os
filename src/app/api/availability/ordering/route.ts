import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/availability/ordering — Toggle ordering open/closed for a delivery date
 * Body: { date, open: boolean }
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { date, open } = await request.json();
  if (!date || typeof open !== "boolean") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await admin
    .from("delivery_dates")
    .update({ ordering_open: open })
    .eq("date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
