import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string }>;

/**
 * POST /api/seeds/[seedId]/germ-tests
 * Body: { germination_pct, tested_on?, seeds_tested?, notes? }
 */
export async function POST(request: Request, { params }: { params: Params }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;

  const { seedId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const pct = typeof body.germination_pct === "number"
    ? body.germination_pct
    : parseFloat(String(body.germination_pct));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ error: "germination_pct must be between 0 and 100" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: seed } = await admin.from("seeds").select("id").eq("id", seedId).single();
  if (!seed) return NextResponse.json({ error: "Seed not found" }, { status: 404 });

  const { data: test, error } = await admin
    .from("seed_germination_tests")
    .insert({
      seed_id: seedId,
      germination_pct: pct,
      tested_on: body.tested_on ? String(body.tested_on) : new Date().toISOString().slice(0, 10),
      seeds_tested: body.seeds_tested != null ? Number(body.seeds_tested) : null,
      notes: body.notes ? String(body.notes).trim() : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ test }, { status: 201 });
}
