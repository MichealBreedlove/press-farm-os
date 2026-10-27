import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

/** Keep only the columns a client may set — a stray id / farm_id / created_at
 *  key from a buggy client must not land in the row. */
function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body) out[k] = body[k];
  return out;
}
const DEMAND_FIELDS = ["crop_id","restaurant_id","day_of_week","target_oz","target_quantity","target_unit","interval_weeks","effective_from","effective_to","notes"] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_demand")
    .update(pick(body, DEMAND_FIELDS))
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demand: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { error } = await (admin as any)
    .from("microgreen_demand")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
