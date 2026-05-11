import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptEventRequest } from "@/lib/event-requests/accept";
import { sendEventRequestAcceptedEmail } from "@/lib/email";

type Params = Promise<{ id: string }>;

interface PatchBody {
  action?: "accept" | "decline";
  admin_response?: string | null;
}

/**
 * PATCH /api/event-requests/[id]
 *
 * Admin-only. Accept or decline a single pending event request. Accept
 * delegates to the shared acceptEventRequest helper (ensures
 * delivery_date, availability, order, order_item), then emails the chef.
 * Decline just stamps status. For batch operations on a whole event
 * group, see POST /api/event-requests/group/[groupId]/respond.
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
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
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = await params;
  const action = body.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: req, error: fetchErr } = await (admin as any)
    .from("event_requests")
    .select(
      "id, restaurant_id, chef_id, item_id, quantity, unit, needed_by_date, event_name, notes, status",
    )
    .eq("id", id)
    .single();
  if (fetchErr || !req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "pending") {
    return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 400 });
  }

  if (action === "decline") {
    const { error: updErr } = await (admin as any)
      .from("event_requests")
      .update({
        status: "declined",
        admin_response: body.admin_response ?? null,
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  // -- Accept path --
  let line;
  try {
    line = await acceptEventRequest(admin, req, user.id, body.admin_response ?? null);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Accept failed" }, { status: 500 });
  }

  // Email the chef. Best-effort — never fails the API.
  try {
    const { data: chefAuth } = await admin.auth.admin.getUserById(req.chef_id);
    const chefEmail = chefAuth?.user?.email ?? null;
    if (chefEmail) {
      const { data: chef } = await (admin as any)
        .from("profiles")
        .select("full_name")
        .eq("id", req.chef_id)
        .single();
      const { data: rest } = await (admin as any)
        .from("restaurants")
        .select("name")
        .eq("id", req.restaurant_id)
        .single();
      await sendEventRequestAcceptedEmail({
        toEmail: chefEmail,
        chefName: chef?.full_name ?? "Chef",
        restaurantName: rest?.name ?? "your restaurant",
        deliveryDate: req.needed_by_date,
        eventName: req.event_name ?? null,
        adminResponse: body.admin_response ?? null,
        items: [{ itemName: line.item_name, quantity: line.quantity, unit: line.unit }],
      });
    }
  } catch (err) {
    console.error("[EVENT REQUEST] accept email failed:", err);
  }

  return NextResponse.json({
    ok: true,
    status: "accepted",
    order_id: line.order_id,
    order_item_id: line.order_item_id,
  });
}
