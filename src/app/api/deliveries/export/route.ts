import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayPacific } from "@/lib/utils";

/**
 * GET /api/deliveries/export?from=YYYY-MM-DD&to=YYYY-MM-DD&restaurantId=...
 *
 * Returns a CSV of delivery_items, one row per fulfilled line, joined with
 * delivery date + restaurant name + item name. Mirrors the legacy
 * DELIVERY TRACKER tab format so it's recognizable + re-importable through
 * the existing delivery-history parser.
 *
 * Columns: Date, Restaurant, Item, Quantity, Unit, Unit Price, Line Total, Status, Notes
 *
 * Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const restaurantId = searchParams.get("restaurantId");

  const admin = createAdminClient();

  // Pull deliveries first (so we can filter by restaurant + date), then their line items
  let dQuery = admin
    .from("deliveries")
    .select("id, delivery_date, restaurant_id, status, notes, restaurants(name)")
    .order("delivery_date", { ascending: false });

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) dQuery = dQuery.gte("delivery_date", from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) dQuery = dQuery.lte("delivery_date", to);
  if (restaurantId) dQuery = dQuery.eq("restaurant_id", restaurantId);

  const { data: deliveries, error: dErr } = await dQuery;
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const deliveryIds = (deliveries ?? []).map((d: any) => d.id);
  if (deliveryIds.length === 0) {
    const body = "﻿" + "Date,Restaurant,Item,Quantity,Unit,Unit Price,Line Total,Status,Notes\r\n";
    return csvResponse(body);
  }

  const { data: lines, error: lErr } = await admin
    .from("delivery_items")
    .select("delivery_id, quantity, unit, unit_price, line_total, items(name)")
    .in("delivery_id", deliveryIds);
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  // Map each line to its delivery for date/restaurant context
  const dById = new Map<string, any>();
  for (const d of deliveries ?? []) dById.set(d.id, d);

  function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const headers = ["Date", "Restaurant", "Item", "Quantity", "Unit", "Unit Price", "Line Total", "Status", "Notes"];
  const rows: string[] = [headers.join(",")];

  for (const line of (lines ?? []) as any[]) {
    const d = dById.get(line.delivery_id);
    if (!d) continue;
    rows.push([
      csvEscape(d.delivery_date),
      csvEscape(d.restaurants?.name ?? ""),
      csvEscape(line.items?.name ?? ""),
      csvEscape(line.quantity != null ? Number(line.quantity).toString() : ""),
      csvEscape(String(line.unit ?? "").toUpperCase()),
      csvEscape(line.unit_price != null ? Number(line.unit_price).toFixed(2) : ""),
      csvEscape(line.line_total != null ? Number(line.line_total).toFixed(2) : ""),
      csvEscape(d.status ?? ""),
      csvEscape(d.notes ?? ""),
    ].join(","));
  }

  return csvResponse("﻿" + rows.join("\r\n"));
}

function csvResponse(body: string) {
  const stamp = todayPacific();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="press-farm-deliveries-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
