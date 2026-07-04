import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string; testId: string }>;

/** DELETE /api/seeds/[seedId]/germ-tests/[testId] */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;

  const { seedId, testId } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("seed_germination_tests")
    .delete()
    .eq("id", testId)
    .eq("seed_id", seedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
