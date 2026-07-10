import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { recordOrderAudit } from "@/lib/order-audit";
import { resolveOrderUnitPrice } from "@/lib/pricing";
import { planOrderItemMerge, type ExistingOrderLine } from "@/lib/orders";

/**
 * PUT /api/orders/[orderId]/edit — Admin full order editor.
 *
 * Lets the admin modify any order at any time, bypassing the chef-side gates
 * (ordering_open, chef-editable status, RLS). Supports:
 *   - changing the delivery date (with merge-on-collision)
 *   - editing the quantity of existing lines
 *   - removing lines (omit them from `kept_lines`)
 *   - adding catalog items as new lines
 *   - editing the freeform notes
 *
 * Because every order_item must reference an availability_items row scoped to
 * (item, restaurant, delivery_date), moving an order to a new date re-points
 * each kept line — and seeds each added line — at the target date's
 * availability row, creating it if it doesn't exist yet (mirrors the
 * chef-form rollover materialization).
 *
 * Writes go through the service-role client (admin-only route), sequenced in
 * JS rather than a dedicated RPC: this is a low-concurrency admin tool, and
 * the financial source of truth is deliveries/delivery_items, not order_items.
 *
 * Body:
 *   {
 *     delivery_date: "YYYY-MM-DD",            // target date (may equal current)
 *     freeform_notes?: string | null,
 *     kept_lines: [{ id, quantity_requested }],   // existing lines to keep (qty may change); omit to delete
 *     new_lines?: [{ item_id, unit_type?, size_label?, quantity_requested }],
 *   }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  const { orderId } = await params;

  interface KeptLine {
    id: string;
    quantity_requested: number;
  }
  interface NewLine {
    item_id: string;
    unit_type?: string | null;
    size_label?: string | null;
    quantity_requested: number;
  }
  let body: {
    delivery_date?: string;
    freeform_notes?: string | null;
    kept_lines?: KeptLine[];
    new_lines?: NewLine[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Snapshot the admin's display name for the audit row.
  const { data: actorProfile } = await (supabase as any)
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user.id)
    .single();
  const actorName: string | null = actorProfile?.full_name ?? null;

  // Load the order + its current lines (with item_id and frozen unit price).
  const { data: order } = await (admin as any)
    .from("orders")
    .select(
      `
      id, restaurant_id, delivery_date, freeform_notes,
      order_items(
        id, availability_item_id, quantity_requested, unit_price_at_order,
        unit_type, size_label, color_key, variety_key, menu_section,
        availability_item:availability_items(id, item_id)
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const restaurantId: string = order.restaurant_id;
  const sourceDate: string = order.delivery_date;
  const targetDate: string = body.delivery_date || sourceDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: "Invalid delivery date" }, { status: 400 });
  }
  const dateChanged = targetDate !== sourceDate;

  // The target must be a real delivery date — orders.delivery_date is an FK.
  const { data: dd } = await (admin as any)
    .from("delivery_dates")
    .select("date")
    .eq("date", targetDate)
    .maybeSingle();
  if (!dd) {
    return NextResponse.json(
      { error: "That delivery date doesn't exist yet. Publish availability for it first." },
      { status: 400 },
    );
  }

  const currentLines: any[] = order.order_items ?? [];
  const currentById = new Map<string, any>(currentLines.map((l) => [l.id, l]));

  // Catalog info for added lines (unit list + pricing).
  const newItemIds = (body.new_lines ?? []).map((l) => l.item_id).filter(Boolean);
  const itemInfo = new Map<string, any>();
  if (newItemIds.length > 0) {
    const { data: items } = await (admin as any)
      .from("items")
      .select("id, unit_type, default_price, unit_prices, size_prices")
      .in("id", newItemIds);
    for (const it of items ?? []) itemInfo.set(it.id, it);
  }

  // Find-or-create the availability_items row for (item, restaurant, date).
  // Every order_item needs one (NOT NULL FK). Idempotent via the unique
  // constraint; re-selects on a race.
  const availCache = new Map<string, string>();
  async function ensureAvailabilityItem(itemId: string, date: string): Promise<string | null> {
    const cacheKey = `${itemId}|${date}`;
    const cached = availCache.get(cacheKey);
    if (cached) return cached;

    const { data: existing } = await (admin as any)
      .from("availability_items")
      .select("id")
      .eq("item_id", itemId)
      .eq("restaurant_id", restaurantId)
      .eq("delivery_date", date)
      .maybeSingle();
    if (existing?.id) {
      availCache.set(cacheKey, existing.id);
      return existing.id;
    }

    const { data: created } = await (admin as any)
      .from("availability_items")
      .insert({
        item_id: itemId,
        restaurant_id: restaurantId,
        delivery_date: date,
        status: "available",
      })
      .select("id")
      .single();
    if (created?.id) {
      availCache.set(cacheKey, created.id);
      return created.id;
    }

    // Lost an insert race — re-select.
    const { data: again } = await (admin as any)
      .from("availability_items")
      .select("id")
      .eq("item_id", itemId)
      .eq("restaurant_id", restaurantId)
      .eq("delivery_date", date)
      .maybeSingle();
    if (again?.id) {
      availCache.set(cacheKey, again.id);
      return again.id;
    }
    return null;
  }

  // Build the desired final line set (target-date availability ids).
  interface DesiredLine {
    availability_item_id: string;
    unit_type: string | null;
    size_label: string | null;
    color_key: string | null;
    variety_key: string | null;
    menu_section: string | null;
    quantity_requested: number;
    unit_price_at_order: number;
    _existingId?: string; // present → carried over from a current line
  }
  const desiredLines: DesiredLine[] = [];

  for (const kept of body.kept_lines ?? []) {
    const cur = currentById.get(kept.id);
    if (!cur) continue;
    const qty = Number(kept.quantity_requested);
    if (!Number.isFinite(qty) || qty <= 0) continue; // zeroed-out = removed
    const itemId: string | undefined = cur.availability_item?.item_id;
    let availId: string = cur.availability_item_id;
    if (dateChanged && itemId) {
      const repointed = await ensureAvailabilityItem(itemId, targetDate);
      if (repointed) availId = repointed;
    }
    desiredLines.push({
      availability_item_id: availId,
      unit_type: cur.unit_type ?? null,
      size_label: cur.size_label ?? null,
      color_key: cur.color_key ?? null,
      variety_key: cur.variety_key ?? null,
      menu_section: cur.menu_section ?? null,
      quantity_requested: qty,
      unit_price_at_order:
        typeof cur.unit_price_at_order === "number" ? cur.unit_price_at_order : 0,
      _existingId: kept.id,
    });
  }

  for (const nl of body.new_lines ?? []) {
    const info = itemInfo.get(nl.item_id);
    if (!info) continue;
    const qty = Number(nl.quantity_requested);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const unit =
      (nl.unit_type ?? "").trim() ||
      String(info.unit_type ?? "").split(",")[0]?.trim() ||
      null;
    const availId = await ensureAvailabilityItem(nl.item_id, targetDate);
    if (!availId) {
      return NextResponse.json(
        { error: "Could not add an item — availability row creation failed." },
        { status: 500 },
      );
    }
    desiredLines.push({
      availability_item_id: availId,
      unit_type: unit,
      size_label: nl.size_label ?? null,
      color_key: null,
      variety_key: null,
      menu_section: null,
      quantity_requested: qty,
      unit_price_at_order: resolveOrderUnitPrice(
        {
          unitPrices: (info.unit_prices ?? {}) as Record<string, number>,
          defaultPrice: typeof info.default_price === "number" ? info.default_price : null,
          sizePrices: (info.size_prices ?? null) as Record<string, number> | null,
        },
        unit,
        nl.size_label ?? null,
      ),
    });
  }

  if (desiredLines.length === 0) {
    return NextResponse.json(
      { error: "An order needs at least one item. Delete the order instead of emptying it." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const mergeNotes = (a: string | null | undefined, b: string | null | undefined): string | null => {
    const prior = (a ?? "").trim();
    const next = (b ?? "").trim();
    if (prior && next && prior !== next) return `${prior}\n\n— Merged in —\n${next}`;
    return prior || next || null;
  };

  // Collision: moving onto a date that already has an order for this restaurant.
  let collisionOrder: any = null;
  if (dateChanged) {
    const { data: collide } = await (admin as any)
      .from("orders")
      .select(
        `
        id, freeform_notes,
        order_items(id, availability_item_id, unit_type, size_label, color_key, variety_key, menu_section, quantity_requested)
      `,
      )
      .eq("restaurant_id", restaurantId)
      .eq("delivery_date", targetDate)
      .neq("id", orderId)
      .maybeSingle();
    collisionOrder = collide ?? null;
  }

  let finalOrderId = orderId;

  if (collisionOrder) {
    // ── Merge into the existing target-date order, then delete the source. ──
    const targetExisting: ExistingOrderLine[] = (collisionOrder.order_items ?? []).map(
      (l: any) => ({
        id: l.id,
        availability_item_id: l.availability_item_id,
        unit_type: l.unit_type ?? null,
        size_label: l.size_label ?? null,
        color_key: l.color_key ?? null,
        variety_key: l.variety_key ?? null,
        menu_section: l.menu_section ?? null,
        quantity_requested: Number(l.quantity_requested ?? 0),
      }),
    );

    const { toInsert, toUpdate } = planOrderItemMerge(targetExisting, desiredLines);

    for (const u of toUpdate) {
      await (admin as any)
        .from("order_items")
        .update({ quantity_requested: u.quantity_requested })
        .eq("id", u.id);
    }
    if (toInsert.length > 0) {
      await (admin as any).from("order_items").insert(
        toInsert.map((l) => ({
          order_id: collisionOrder.id,
          availability_item_id: l.availability_item_id,
          quantity_requested: l.quantity_requested,
          unit_price_at_order: l.unit_price_at_order,
          unit_type: l.unit_type,
          size_label: l.size_label,
          color_key: l.color_key,
          variety_key: l.variety_key,
          menu_section: l.menu_section,
          created_by: auth.user.id,
        })),
      );
    }

    // Delete the source order (cascade removes its items).
    await (admin as any).from("order_items").delete().eq("order_id", orderId);
    await (admin as any).from("orders").delete().eq("id", orderId);

    await (admin as any)
      .from("orders")
      .update({
        freeform_notes: mergeNotes(collisionOrder.freeform_notes, body.freeform_notes),
        last_edited_by: auth.user.id,
        last_edited_at: now,
      })
      .eq("id", collisionOrder.id);

    finalOrderId = collisionOrder.id;

    await recordOrderAudit(admin, {
      orderId: finalOrderId,
      restaurantId,
      deliveryDate: targetDate,
      actorId: auth.user.id,
      actorName,
      action: "merged",
      detail: {
        added: toInsert.length,
        bumped: toUpdate.length,
        moved_from: sourceDate,
        merged_into: targetDate,
      },
    });
  } else {
    // ── No collision: reconcile this order's lines in place (or after move). ──
    if (dateChanged) {
      await (admin as any)
        .from("orders")
        .update({ delivery_date: targetDate })
        .eq("id", orderId);
    }

    const keptIds = new Set(
      desiredLines.filter((d) => d._existingId).map((d) => d._existingId as string),
    );
    const toDeleteIds = currentLines.filter((l) => !keptIds.has(l.id)).map((l) => l.id);
    if (toDeleteIds.length > 0) {
      await (admin as any).from("order_items").delete().in("id", toDeleteIds);
    }

    for (const d of desiredLines) {
      if (!d._existingId) continue;
      await (admin as any)
        .from("order_items")
        .update({
          quantity_requested: d.quantity_requested,
          availability_item_id: d.availability_item_id,
        })
        .eq("id", d._existingId);
    }

    const newOnes = desiredLines.filter((d) => !d._existingId);
    if (newOnes.length > 0) {
      await (admin as any).from("order_items").insert(
        newOnes.map((d) => ({
          order_id: orderId,
          availability_item_id: d.availability_item_id,
          quantity_requested: d.quantity_requested,
          unit_price_at_order: d.unit_price_at_order,
          unit_type: d.unit_type,
          size_label: d.size_label,
          color_key: d.color_key,
          variety_key: d.variety_key,
          menu_section: d.menu_section,
          created_by: auth.user.id,
        })),
      );
    }

    await (admin as any)
      .from("orders")
      .update({
        freeform_notes: body.freeform_notes ?? null,
        last_edited_by: auth.user.id,
        last_edited_at: now,
      })
      .eq("id", orderId);

    await recordOrderAudit(admin, {
      orderId,
      restaurantId,
      deliveryDate: targetDate,
      actorId: auth.user.id,
      actorName,
      action: "edited",
      detail: dateChanged
        ? { item_count: desiredLines.length, moved_from: sourceDate, moved_to: targetDate }
        : { item_count: desiredLines.length },
    });
  }

  return NextResponse.json({ data: { orderId: finalOrderId, delivery_date: targetDate }, error: null });
}
