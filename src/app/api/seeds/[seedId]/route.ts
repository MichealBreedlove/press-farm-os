import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_STATUSES } from "@/lib/constants";

const VALID_STATUSES = new Set<string>(SEED_STATUSES);
type Params = Promise<{ seedId: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * GET /api/seeds/[seedId]
 * Returns the seed with on_hand, sowing history, and germ test history.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId } = await params;
  const admin = createAdminClient();

  const { data: seed, error } = await admin
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .eq("id", seedId)
    .single();
  if (error || !seed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sowings } = await admin
    .from("seed_sowings")
    .select("*, planting:plantings(id, crop_name, variety, sow_date)")
    .eq("seed_id", seedId)
    .order("sown_on", { ascending: false });

  const { data: germTests } = await admin
    .from("seed_germination_tests")
    .select("*")
    .eq("seed_id", seedId)
    .order("tested_on", { ascending: false });

  return NextResponse.json({
    seed,
    sowings: sowings ?? [],
    germTests: germTests ?? [],
  });
}

/**
 * PATCH /api/seeds/[seedId]
 * Body: any subset of editable fields.
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { seedId } = await params;
  const updates: Record<string, unknown> = {};

  if (body.variety !== undefined) {
    const v = String(body.variety).trim();
    if (!v) return NextResponse.json({ error: "variety cannot be empty" }, { status: 400 });
    updates.variety = v;
  }
  if (body.initial_quantity !== undefined) {
    const n = typeof body.initial_quantity === "number"
      ? body.initial_quantity
      : parseFloat(String(body.initial_quantity));
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "initial_quantity must be a non-negative number" }, { status: 400 });
    }
    updates.initial_quantity = n;
  }
  if (body.quantity_unit !== undefined) {
    const u = String(body.quantity_unit).trim();
    if (!u) return NextResponse.json({ error: "quantity_unit cannot be empty" }, { status: 400 });
    updates.quantity_unit = u;
  }
  if (body.packed_for_year !== undefined) {
    updates.packed_for_year = body.packed_for_year == null ? null : Number(body.packed_for_year);
  }
  if (body.purchase_date !== undefined) {
    updates.purchase_date = body.purchase_date ? String(body.purchase_date) : null;
  }
  if (body.supplier !== undefined) {
    updates.supplier = body.supplier ? String(body.supplier).trim() : null;
  }
  if (body.cost !== undefined) {
    updates.cost = body.cost == null ? null : Number(body.cost);
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(String(body.status))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes ? String(body.notes).trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: seed, error } = await admin
    .from("seeds")
    .update(updates)
    .eq("id", seedId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seed });
}

/**
 * DELETE /api/seeds/[seedId]
 * Only allowed if the seed has no sowings. Otherwise client should
 * PATCH status to 'discarded' to archive without losing history.
 */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId } = await params;
  const admin = createAdminClient();

  const { count } = await admin
    .from("seed_sowings")
    .select("id", { count: "exact", head: true })
    .eq("seed_id", seedId);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cannot delete a seed with logged sowings. Set status to 'discarded' instead." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("seeds").delete().eq("id", seedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
