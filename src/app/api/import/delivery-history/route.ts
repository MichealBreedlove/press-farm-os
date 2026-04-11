import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

/**
 * POST /api/import/delivery-history?preview=true|false
 * Accepts multipart form with .xlsx file.
 * Parses DELIVERY TRACKER tab: Date, Restaurant, Item, Qty, Unit, Price, Total.
 * Groups by date+restaurant → creates deliveries + delivery_items (status=finalized).
 * Items matched by name to existing catalog.
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const preview = searchParams.get("preview") === "true";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  // Find DELIVERY TRACKER sheet
  const sheetName = workbook.SheetNames.find((n) =>
    n.trim().toUpperCase().includes("DELIVERY")
  );
  if (!sheetName) {
    return NextResponse.json(
      { error: `Delivery tab not found. Available tabs: ${workbook.SheetNames.join(", ")}` },
      { status: 422 }
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  interface ParsedLine {
    date: string;
    restaurant: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }

  const UNIT_MAP: Record<string, string> = {
    ea: "ea", each: "ea",
    sm: "sm", small: "sm",
    lg: "lg", large: "lg",
    lbs: "lbs", lb: "lbs", pound: "lbs", pounds: "lbs",
    bu: "bu", bunch: "bu", bunches: "bu",
    qt: "qt", quart: "qt",
    bx: "bx", box: "bx",
    cs: "cs", case: "cs",
    pt: "pt", pint: "pt",
    kit: "kit",
  };

  function normalizeUnit(raw: string): string {
    const key = String(raw).trim().toLowerCase();
    return UNIT_MAP[key] ?? "ea";
  }

  function parseDate(raw: unknown): string | null {
    if (!raw) return null;
    if (raw instanceof Date) {
      return raw.toISOString().slice(0, 10);
    }
    // Try numeric serial (Excel date)
    const num = Number(raw);
    if (!isNaN(num) && num > 40000) {
      const d = XLSX.SSF.parse_date_code(num);
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    // Try string date
    const d = new Date(String(raw));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  const lines: ParsedLine[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const date = parseDate(
      row["Date"] ?? row["date"] ?? row["DATE"] ?? row["Delivery Date"] ?? row["delivery_date"]
    );
    const restaurant = String(
      row["Restaurant"] ?? row["restaurant"] ?? row["RESTAURANT"] ?? row["Account"] ?? "Press"
    ).trim();
    const itemName = String(
      row["Item"] ?? row["item"] ?? row["ITEM"] ?? row["Item Name"] ?? row["item_name"] ?? ""
    ).trim();
    const quantity = parseFloat(String(row["Quantity"] ?? row["Qty"] ?? row["qty"] ?? row["QTY"] ?? 0));
    const unitRaw = String(row["Unit"] ?? row["unit"] ?? row["UNIT"] ?? "ea").trim();
    const unitPrice = parseFloat(String(row["Price"] ?? row["Unit Price"] ?? row["unit_price"] ?? row["Price Per Unit"] ?? 0).replace(/[^0-9.]/g, ""));
    const lineTotal = parseFloat(String(row["Total"] ?? row["Line Total"] ?? row["line_total"] ?? 0).replace(/[^0-9.]/g, ""));

    if (!date || !itemName || isNaN(quantity) || quantity <= 0) {
      if (itemName) skipped.push(itemName);
      continue;
    }

    lines.push({
      date,
      restaurant,
      itemName,
      quantity,
      unit: normalizeUnit(unitRaw),
      unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
      lineTotal: isNaN(lineTotal) ? quantity * (isNaN(unitPrice) ? 0 : unitPrice) : lineTotal,
    });
  }

  // Group by date + restaurant
  const grouped: Record<string, ParsedLine[]> = {};
  for (const line of lines) {
    const key = `${line.date}::${line.restaurant}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(line);
  }

  const deliveryCount = Object.keys(grouped).length;

  if (preview) {
    const sample = Object.entries(grouped).slice(0, 5).map(([key, items]) => ({
      key,
      items: items.map((i) => ({ item: i.itemName, qty: i.quantity, unit: i.unit, price: i.unitPrice })),
    }));
    return NextResponse.json({ deliveries: deliveryCount, lines: lines.length, skipped: skipped.length, sample });
  }

  const admin = createAdminClient();

  // Load items catalog for name → id matching
  const { data: allItems } = await (admin as any)
    .from("items")
    .select("id, name");
  const itemByName: Record<string, string> = {};
  for (const item of allItems ?? []) {
    itemByName[item.name.toLowerCase().trim()] = item.id;
  }

  // Load restaurants for name → id matching
  const { data: allRestaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name, farm_id");
  const restaurantByName: Record<string, { id: string; farm_id: string }> = {};
  for (const r of allRestaurants ?? []) {
    restaurantByName[r.name.toLowerCase().trim()] = { id: r.id, farm_id: r.farm_id };
    // Also try partial matches (e.g. "Press" matches "The Press")
    const words = r.name.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 3 && !restaurantByName[w]) {
        restaurantByName[w] = { id: r.id, farm_id: r.farm_id };
      }
    }
  }

  // Fallback: use first restaurant
  const fallbackRestaurant = allRestaurants?.[0];

  let importedDeliveries = 0;
  let importedLines = 0;
  let lineErrors = 0;

  for (const [, lineItems] of Object.entries(grouped)) {
    const { date, restaurant } = lineItems[0];
    const restKey = restaurant.toLowerCase().trim();
    const restMatch = restaurantByName[restKey] ?? (fallbackRestaurant ? { id: fallbackRestaurant.id, farm_id: fallbackRestaurant.farm_id } : null);
    if (!restMatch) { lineErrors += lineItems.length; continue; }

    // Upsert delivery
    const { data: existing } = await (admin as any)
      .from("deliveries")
      .select("id")
      .eq("delivery_date", date)
      .eq("restaurant_id", restMatch.id)
      .maybeSingle();

    let deliveryId: string;
    if (existing) {
      deliveryId = existing.id;
      await (admin as any).from("delivery_items").delete().eq("delivery_id", deliveryId);
    } else {
      const { data: newDel, error: delErr } = await (admin as any)
        .from("deliveries")
        .insert({ restaurant_id: restMatch.id, delivery_date: date, status: "finalized" })
        .select("id")
        .single();
      if (delErr || !newDel) { lineErrors += lineItems.length; continue; }
      deliveryId = newDel.id;
    }

    // Insert line items, skipping unknown items
    const rows = lineItems
      .map((li) => {
        const itemId = itemByName[li.itemName.toLowerCase().trim()];
        if (!itemId) return null;
        return {
          delivery_id: deliveryId,
          item_id: itemId,
          quantity: li.quantity,
          unit: li.unit,
          unit_price: li.unitPrice,
          line_total: Math.round(li.lineTotal * 100) / 100,
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      const { error: rowErr } = await (admin as any).from("delivery_items").insert(rows);
      if (rowErr) { lineErrors += rows.length; }
      else { importedLines += rows.length; }
    }

    importedDeliveries++;
  }

  return NextResponse.json({ importedDeliveries, importedLines, lineErrors, skipped: skipped.length });
}
