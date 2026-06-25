import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendShortageEmail } from "@/lib/email";
import { recordOrderAudit } from "@/lib/order-audit";

/**
 * PATCH /api/orders/[orderId]/shortage — Mark order items as shorted (admin only)
 *
 * Body: { items: [{order_item_id, quantity_fulfilled, shortage_reason}] }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const supabase = await createClient();
  const { orderId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin (full_name doubles as the audit actor snapshot below)
  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profileRaw || profileRaw.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    items: {
      order_item_id: string;
      quantity_fulfilled: number;
      shortage_reason: string | null;
      clear?: boolean;
      // Substitution — what was sent in place of this shorted line. All fields
      // optional; pass `replacement: null` (or omit) to leave/clear it.
      replacement?: {
        item_id?: string | null;
        label?: string | null;
        quantity?: number | null;
        unit?: string | null;
      } | null;
    }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Missing items array" }, { status: 400 });
  }

  const invalidItems = items.filter((item: any) =>
    !item.order_item_id ||
    typeof item.quantity_fulfilled !== 'number' ||
    !Number.isFinite(item.quantity_fulfilled) ||
    item.quantity_fulfilled < 0
  );
  if (invalidItems.length > 0) {
    return NextResponse.json({ error: 'Invalid shortage item data' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Verify the order exists, fetch order_items to compare quantities
  const { data: order, error: orderError } = await (adminClient.from("orders") as any)
    .select("id, order_items(id, quantity_requested)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const itemQtyMap = new Map<string, number>(
    (order.order_items ?? []).map((oi: any) => [oi.id, oi.quantity_requested])
  );

  // Track per-line outcome (marked vs cleared) for the audit trail below.
  const lineOutcome = new Map<string, { cleared: boolean; reason: string | null; replacementLabel: string | null }>();

  // Update each order item — auto-clear shortage if fulfilled >= requested or `clear` flag set
  const updates = await Promise.all(
    items.map(({ order_item_id, quantity_fulfilled, shortage_reason, clear, replacement }) => {
      const requested = itemQtyMap.get(order_item_id) ?? Infinity;
      const shouldClear = clear || quantity_fulfilled >= requested;

      // Resolve the substitution. Clearing a shortage clears the replacement
      // too — a fulfilled line has nothing to substitute. The label is the
      // chef-facing name; if a replacement item_id is given without an explicit
      // label the caller is expected to also send the label (the UI does).
      const rawLabel = replacement?.label?.trim() || null;
      const hasReplacement = !shouldClear && Boolean(replacement?.item_id || rawLabel);
      const replacementLabel = hasReplacement ? rawLabel : null;

      lineOutcome.set(order_item_id, {
        cleared: shouldClear,
        reason: shouldClear ? null : shortage_reason,
        replacementLabel,
      });
      return (adminClient.from("order_items") as any)
        .update({
          is_shorted: !shouldClear,
          quantity_fulfilled: shouldClear ? requested : quantity_fulfilled,
          shortage_reason: shouldClear ? null : shortage_reason,
          replacement_item_id: hasReplacement ? (replacement?.item_id ?? null) : null,
          replacement_label: replacementLabel,
          replacement_quantity:
            hasReplacement && Number.isFinite(replacement?.quantity as number)
              ? replacement?.quantity
              : null,
          replacement_unit: hasReplacement ? (replacement?.unit?.trim() || null) : null,
        })
        .eq("id", order_item_id)
        .eq("order_id", orderId);
    })
  );

  const firstError = updates.find((r) => r.error);
  if (firstError?.error) {
    console.error("Shortage update error:", firstError.error);
    return NextResponse.json({ error: "Failed to update shortage info" }, { status: 500 });
  }

  // Fetch updated order with full details (for response + email)
  const { data: updatedOrder, error: fetchError } = await (adminClient.from("orders") as any)
    .select(`
      *,
      delivery_date,
      chef_id,
      restaurant:restaurants(name),
      chef:profiles!orders_chef_id_fkey(full_name),
      order_items(
        id,
        quantity_requested,
        quantity_fulfilled,
        is_shorted,
        shortage_reason,
        replacement_label,
        replacement_quantity,
        replacement_unit,
        availability_item:availability_items(
          item:items(name, unit_type)
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch updated order" }, { status: 500 });
  }

  // Send shortage notice email to the chef — non-blocking, errors do not fail the response
  try {
    const shortedItems = (updatedOrder?.order_items ?? []).filter((oi: any) => oi.is_shorted);

    if (shortedItems.length > 0 && updatedOrder?.chef_id) {
      const { data: chefUserData } = await adminClient.auth.admin.getUserById(updatedOrder.chef_id);
      const chefEmail = chefUserData?.user?.email;

      if (chefEmail) {
        const shortages = shortedItems.map((oi: any) => {
          const item = oi.availability_item?.item;
          // unit_type may be comma-separated; surface the first as the email's display unit
          const unit = String(item?.unit_type ?? "").split(",")[0]?.trim() ?? "";
          // Substitution copy for the chef: "Miracle" or "Miracle (2 BU)".
          const replacementLabel = (oi.replacement_label ?? "").trim();
          let replacement: string | null = null;
          if (replacementLabel) {
            const rq = oi.replacement_quantity;
            const ru = String(oi.replacement_unit ?? "").trim();
            replacement =
              rq != null && Number.isFinite(Number(rq))
                ? `${replacementLabel} (${Number(rq)}${ru ? ` ${ru.toUpperCase()}` : ""})`
                : replacementLabel;
          }
          return {
            itemName: item?.name ?? "Unknown item",
            requestedQty: oi.quantity_requested,
            fulfilledQty: oi.quantity_fulfilled ?? 0,
            unit,
            reason: oi.shortage_reason ?? "",
            replacement,
          };
        });

        await sendShortageEmail({
          toEmail: chefEmail,
          chefName: updatedOrder.chef?.full_name ?? "Chef",
          restaurantName: updatedOrder.restaurant?.name ?? "Restaurant",
          deliveryDate: updatedOrder.delivery_date,
          shortages,
        });
      }
    }
  } catch (emailErr) {
    console.error("[EMAIL] Failed to send shortage notice email:", emailErr);
  }

  // Audit trail — non-blocking. One row per touched line: 'shortage_marked'
  // when the line is now short, 'shortage_cleared' when it was resolved.
  // detail carries { item, reason } so the timeline reads naturally.
  const itemNameById = new Map<string, string>(
    (updatedOrder?.order_items ?? []).map((oi: any) => [
      oi.id,
      oi.availability_item?.item?.name ?? "Unknown item",
    ]),
  );
  const restaurantId: string | undefined = updatedOrder?.restaurant_id;
  if (restaurantId) {
    await Promise.all(
      Array.from(lineOutcome.entries()).map(([orderItemId, outcome]) =>
        recordOrderAudit(adminClient, {
          orderId,
          restaurantId,
          deliveryDate: updatedOrder?.delivery_date ?? null,
          actorId: user.id,
          actorName: profileRaw.full_name ?? null,
          action: outcome.cleared ? "shortage_cleared" : "shortage_marked",
          detail: {
            item: itemNameById.get(orderItemId) ?? "Unknown item",
            reason: outcome.reason,
            ...(outcome.replacementLabel ? { replacement: outcome.replacementLabel } : {}),
          },
        }),
      ),
    );
  }

  return NextResponse.json({ data: updatedOrder, error: null });
}
