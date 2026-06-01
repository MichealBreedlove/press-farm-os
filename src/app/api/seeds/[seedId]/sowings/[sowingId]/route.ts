import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string; sowingId: string }>;

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

/** DELETE /api/seeds/[seedId]/sowings/[sowingId] */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

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
