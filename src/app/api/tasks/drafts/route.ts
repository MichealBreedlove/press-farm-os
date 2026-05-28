import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import { listPendingDrafts } from "@/lib/tasks/queries";

/**
 * GET /api/tasks/drafts — list pending inbox-derived task drafts awaiting
 * user confirmation. Sorted newest first.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const admin = createAdminClient();
  const drafts = await listPendingDrafts(admin);
  return NextResponse.json({ drafts });
}
