import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptEventRequest, type AcceptedLine } from "@/lib/event-requests/accept";
import { sendEventRequestAcceptedEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/api-auth";

type Params = Promise<{ groupId: string }>;

interface PostBody {
  action?: "accept" | "decline";
  admin_response?: string | null;
}

/**
 * POST /api/event-requests/group/[groupId]/respond
 *
 * Admin-only. Accept or decline every pending row in an event group
 * (rows sharing event_group_id from the multi-item chef submission).
 * Accepts and declines are processed per row so a single bad row
 * doesn't sink the whole batch; the response summarizes successes and
 * any per-row failures. On accept the chef receives one combined email
 * listing every line that landed on their order.
 *
 * Already-resolved rows (accepted/declined) inside the group are
 * skipped, not re-resolved.
 */
export async function POST(request: Request, { params }: { params: Params }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { groupId } = await params;
  const action = body.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: rows, error: fetchErr } = await admin
    .from("event_requests")
    .select(
      "id, restaurant_id, chef_id, item_id, quantity, unit, needed_by_date, event_name, notes, status",
    )
    .eq("event_group_id", groupId)
    .order("created_at", { ascending: true });
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const pending = (rows as any[]).filter((r) => r.status === "pending");
  if (pending.length === 0) {
    return NextResponse.json({ error: "No pending requests in this group" }, { status: 400 });
  }

  // -- Decline path --
  if (action === "decline") {
    const pendingIds = pending.map((r) => r.id);
    const { error: updErr } = await admin
      .from("event_requests")
      .update({
        status: "declined",
        admin_response: body.admin_response ?? null,
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .in("id", pendingIds);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, declined: pendingIds.length });
  }

  // -- Accept path -- run per row so one failure doesn't take down the batch.
  const accepted: AcceptedLine[] = [];
  const failed: { request_id: string; error: string }[] = [];
  for (const r of pending) {
    try {
      const line = await acceptEventRequest(admin, r, user.id, body.admin_response ?? null);
      accepted.push(line);
    } catch (err: any) {
      failed.push({ request_id: r.id, error: err?.message ?? "Accept failed" });
    }
  }

  // Combined email — one per chef. All rows in a group share chef + restaurant
  // + date + event so we can pull the metadata from the first pending row.
  if (accepted.length > 0) {
    try {
      const first = pending[0];
      const { data: chefAuth } = await admin.auth.admin.getUserById(first.chef_id);
      const chefEmail = chefAuth?.user?.email ?? null;
      if (chefEmail) {
        const { data: chef } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", first.chef_id)
          .single();
        const { data: rest } = await admin
          .from("restaurants")
          .select("name")
          .eq("id", first.restaurant_id)
          .single();
        await sendEventRequestAcceptedEmail({
          toEmail: chefEmail,
          chefName: chef?.full_name ?? "Chef",
          restaurantName: rest?.name ?? "your restaurant",
          deliveryDate: first.needed_by_date,
          eventName: first.event_name ?? null,
          adminResponse: body.admin_response ?? null,
          items: accepted.map((a) => ({
            itemName: a.item_name,
            quantity: a.quantity,
            unit: a.unit,
          })),
        });
      }
    } catch (err) {
      console.error("[EVENT REQUEST GROUP] accept email failed:", err);
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    accepted_count: accepted.length,
    failed_count: failed.length,
    failed,
  });
}
