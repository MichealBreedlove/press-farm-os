import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .select("*, batch:microgreen_batches(*, crop:microgreen_crops(*))")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tray: data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;
  const body = await req.json();
  // Only allow editing safe fields here — status transitions go through advance/terminate.
  const safe: Record<string, unknown> = {};
  for (const k of ["location", "notes"]) {
    if (k in body) safe[k] = body[k];
  }
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update(safe)
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tray: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(await createClient());
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  // Guard: no harvest history (not active/inactive status) — allows hard-deleting typo'd lost/terminated trays.
  const { data: harvests, error: countErr } = await (admin as any)
    .from("microgreen_harvests")
    .select("id")
    .eq("tray_id", params.id)
    .limit(1);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((harvests ?? []).length > 0) {
    return NextResponse.json(
      { error: "Tray has harvest events. Mark as lost or terminated instead." },
      { status: 409 },
    );
  }

  const { error } = await (admin as any)
    .from("microgreen_trays").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
