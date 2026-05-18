import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * POST /api/seeds/[seedId]/sowings
 * Body: { amount_used, planting_id?, sown_on?, notes? }
 */
export async function POST(request: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const amount = typeof body.amount_used === "number"
    ? body.amount_used
    : parseFloat(String(body.amount_used));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount_used must be a positive number" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify seed exists
  const { data: seed } = await (admin as any).from("seeds").select("id").eq("id", seedId).single();
  if (!seed) return NextResponse.json({ error: "Seed not found" }, { status: 404 });

  // Verify planting if provided
  let planting_id: string | null = null;
  if (body.planting_id) {
    const { data: p } = await (admin as any)
      .from("plantings").select("id").eq("id", body.planting_id).single();
    if (!p) return NextResponse.json({ error: "planting_id does not match any planting" }, { status: 400 });
    planting_id = String(body.planting_id);
  }

  const { data: sowing, error } = await (admin as any)
    .from("seed_sowings")
    .insert({
      seed_id: seedId,
      planting_id,
      amount_used: amount,
      sown_on: body.sown_on ? String(body.sown_on) : new Date().toISOString().slice(0, 10),
      notes: body.notes ? String(body.notes).trim() : null,
    })
    .select("*, planting:plantings(id, crop_name, variety, sow_date)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sowing }, { status: 201 });
}
