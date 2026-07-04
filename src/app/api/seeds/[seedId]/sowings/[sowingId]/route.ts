import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string; sowingId: string }>;

/** DELETE /api/seeds/[seedId]/sowings/[sowingId] */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;

  const { seedId, sowingId } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("seed_sowings")
    .delete()
    .eq("id", sowingId)
    .eq("seed_id", seedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
