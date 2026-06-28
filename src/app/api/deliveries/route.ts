import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrderUnitPrice } from "@/lib/pricing";

/**
 * GET /api/deliveries?month=2026-04
 * Lists deliveries for a month with items.
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // e.g. "2026-04"

  const admin = createAdminClient();
  let query = admin
    .from("deliveries")
    .select(`
      id, delivery_date, status, total_value, notes, created_at,
      restaurants ( id, name ),
      delivery_items (
        id, quantity, unit, unit_price, line_total, size_label,
        items ( id, name, category )
      )
    `)
    .order("delivery_date", { ascending: false });

  if (month) {
    const start = `${month}-01`;
    const end = new Date(
      parseInt(month.split("-")[0]),
      parseInt(month.split("-")[1]),
      0
    )
      .toISOString()
      .slice(0, 10);
    query = query.gte("delivery_date", start).lte("delivery_date", end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deliveries: data });
}

/**
 * POST /api/deliveries
 * Body: { delivery_date, restaurant_id, notes?, items: [{ item_id, quantity, unit, unit_price }] }
 * Upserts delivery + delivery_items. Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: {
    delivery_date: string;
    restaurant_id: string;
    notes?: string;
    items: { item_id: string; quantity: number; unit: string; unit_price: number; size_label?: string | null; is_bonus?: boolean; bonus_note?: string | null }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { delivery_date, restaurant_id, notes, items } = body;

  if (!delivery_date || !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) {
    return NextResponse.json({ error: "Invalid delivery_date" }, { status: 400 });
  }
  if (!restaurant_id) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  // Validate items. Normalize unit to lowercase before the DB CHECK
  // constraint sees it — the input on DeliveryLogForm renders uppercase
  // via CSS but submits the raw typed value, so 'LG' would otherwise
  // hit delivery_items_unit_check and surface as an opaque Postgres error.
  const ALLOWED_UNITS = new Set(['ea', 'sm', 'lg', 'gb', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit']);
  for (const item of items) {
    if (!item.item_id) return NextResponse.json({ error: "Each item needs item_id" }, { status: 400 });
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      return NextResponse.json({ error: "Invalid unit_price" }, { status: 400 });
    }
    item.unit = String(item.unit ?? '').trim().toLowerCase();
    if (!ALLOWED_UNITS.has(item.unit)) {
      return NextResponse.json(
        { error: `Invalid unit "${item.unit}". Must be one of: ${[...ALLOWED_UNITS].join(', ')}` },
        { status: 400 },
      );
    }
  }

  const admin = createAdminClient();

  // Enforce: no delivery line is ever saved at $0. A price of 0/blank — most
  // often a bonus/extra line whose price field was cleared — is backfilled from
  // the item's catalog price (unit_prices[unit] → default_price). Bonus items
  // in particular must carry their real value, not $0, so they're tracked
  // rather than silently dropped from revenue.
  const needsPrice = items.filter((it) => !(it.unit_price > 0));
  if (needsPrice.length > 0) {
    const ids = [...new Set(needsPrice.map((it) => it.item_id))];
    const { data: priceRows } = await (admin as any)
      .from("items")
      .select("id, unit_prices, default_price")
      .in("id", ids);
    const priceMap = new Map<string, any>(
      ((priceRows ?? []) as any[]).map((r) => [r.id as string, r]),
    );
    for (const it of items) {
      if (it.unit_price > 0) continue;
      const row = priceMap.get(it.item_id);
      if (!row) continue;
      it.unit_price = resolveOrderUnitPrice(
        {
          unitPrices: (row.unit_prices ?? {}) as Record<string, number>,
          defaultPrice: row.default_price != null ? Number(row.default_price) : null,
        },
        it.unit,
      );
    }
  }

  // Upsert delivery record
  const { data: existing } = await admin
    .from("deliveries")
    .select("id")
    .eq("delivery_date", delivery_date)
    .eq("restaurant_id", restaurant_id)
    .maybeSingle();

  let deliveryId: string;

  if (existing) {
    deliveryId = existing.id;
    // Delete old items before reinserting
    await admin.from("delivery_items").delete().eq("delivery_id", deliveryId);
    await admin
      .from("deliveries")
      .update({ notes: notes ?? null, status: "logged" })
      .eq("id", deliveryId);
  } else {
    const { data: newDelivery, error: deliveryError } = await admin
      .from("deliveries")
      .insert({
        restaurant_id,
        delivery_date,
        notes: notes ?? null,
        status: "logged",
      })
      .select("id")
      .single();

    if (deliveryError) {
      return NextResponse.json({ error: deliveryError.message }, { status: 500 });
    }
    deliveryId = newDelivery.id;
  }

  // Insert delivery items
  const deliveryItems = items.map((item) => ({
    delivery_id: deliveryId,
    item_id: item.item_id,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    size_label: item.size_label?.trim() || null,
    is_bonus: item.is_bonus ?? false,
    bonus_note: item.bonus_note ?? null,
  }));

  const { error: itemsError } = await admin
    .from("delivery_items")
    .insert(deliveryItems);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Fetch updated delivery with total (trigger recalculates total_value)
  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, total_value, status")
    .eq("id", deliveryId)
    .single();

  return NextResponse.json({ delivery }, { status: existing ? 200 : 201 });
}

/**
 * DELETE /api/deliveries
 * Body: { scope: "all" } | { ids: string[] }
 *
 * Removes deliveries. delivery_items.delivery_id cascades on delete
 * (per migration 005), so the line items go with each parent row —
 * no manual cleanup needed.
 *
 * IMPORTANT: deliveries are the financial source of truth. The UI
 * gates this behind a typed confirmation; the server checks admin
 * role + requires an explicit `confirm: "DELETE"` body field as a
 * second guard to prevent accidental wipes from a bad client.
 *
 * Returns: { deleted: number, totalValueDeleted: number }
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { scope?: string; ids?: unknown; confirm?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation required — body must include { confirm: \"DELETE\" }" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Compute "before" stats for the response so the UI can confirm what
  // was nuked. Cheap aggregate, runs against the same scope as the
  // delete itself.
  let baseQuery = admin.from("deliveries");

  let countBefore = 0;
  let valueBefore = 0;

  if (body.scope === "all") {
    const { data: stats } = await baseQuery.select("id, total_value");
    countBefore = (stats ?? []).length;
    valueBefore = (stats ?? []).reduce(
      (s: number, d: any) => s + (Number(d.total_value) || 0),
      0,
    );

    const { error } = await admin.from("deliveries").delete().not("id", "is", null);
    if (error) {
      console.error("DELETE all deliveries failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    const ids = body.ids.filter((v): v is string => typeof v === "string");
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty string array" }, { status: 400 });
    }
    const { data: stats } = await baseQuery.select("id, total_value").in("id", ids);
    countBefore = (stats ?? []).length;
    valueBefore = (stats ?? []).reduce(
      (s: number, d: any) => s + (Number(d.total_value) || 0),
      0,
    );

    const { error } = await admin.from("deliveries").delete().in("id", ids);
    if (error) {
      console.error("DELETE deliveries by id failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json(
      { error: "Provide either scope: \"all\" or ids: string[]" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    deleted: countBefore,
    totalValueDeleted: valueBefore,
  });
}
