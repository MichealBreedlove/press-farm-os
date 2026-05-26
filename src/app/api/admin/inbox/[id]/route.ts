/**
 * PATCH /api/admin/inbox/[id]
 *
 * Admin-only actions on an inbound message:
 *   - mark_read   → status = 'read'
 *   - mark_unread → status = 'unread'
 *   - archive     → status = 'archived'
 *   - reextract   → reset extraction_status to 'pending' and fire the
 *                   LLM extractor again (deletes any prior auto-extracted
 *                   suggestions linked to this message first).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractItemRequests } from "@/lib/extraction/item-requests";

const VALID_ACTIONS = ["mark_read", "mark_unread", "archive", "reextract"] as const;
type Action = (typeof VALID_ACTIONS)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action as Action;
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "reextract") {
    // Clear prior auto-extracted suggestions linked to this message so the
    // re-run doesn't double up.
    await (admin as any)
      .from("suggestions")
      .delete()
      .eq("inbound_message_id", params.id)
      .eq("source", "email_reply");

    const { error: updErr } = await (admin as any)
      .from("inbound_messages")
      .update({
        extraction_status: "pending",
        extraction_error: null,
        extracted_at: null,
      })
      .eq("id", params.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Block on extraction so the user sees the result on refresh.
    await extractItemRequests({ inboundMessageId: params.id });
    return NextResponse.json({ ok: true });
  }

  const status =
    action === "mark_read" ? "read" : action === "mark_unread" ? "unread" : "archived";

  const { error } = await (admin as any)
    .from("inbound_messages")
    .update({ status })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
