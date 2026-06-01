import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

interface ParsedLine {
  date: string;
  restaurant: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  status: string;
  notes: string;
}

const UNIT_MAP: Record<string, string> = {
  ea: "ea", each: "ea",
  sm: "sm", small: "sm",
  lg: "lg", large: "lg",
  gb: "gb", "green bin": "gb",
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

function parseDateValue(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    if (num > 1 && num < 100000) {
      const d = XLSX.SSF.parse_date_code(num);
      if (d && d.y) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Look up a row value by trying multiple header names — case-insensitive,
 * whitespace/punctuation-insensitive. Real-world XLSX exports often have
 * stray leading/trailing spaces (e.g. " Unit Price " from Excel quirks),
 * which strict equality misses; normalize() collapses both sides.
 */
function normalizeKey(k: string): string {
  return String(k ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function pick(row: Record<string, unknown>, ...keys: string[]): string {
  // Build a normalized lookup map once per call, then probe each candidate
  const norm: Record<string, unknown> = {};
  for (const [rawKey, val] of Object.entries(row)) {
    norm[normalizeKey(rawKey)] = val;
  }
  for (const k of keys) {
    const v = norm[normalizeKey(k)];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/**
 * POST /api/import/deliveries-csv?preview=true|false
 *
 * Auto-detects two formats:
 *  - Legacy XLSX with a sheet whose name contains "DELIVERY" (the original
 *    Daily Delivery Tracking Sheet's DELIVERY TRACKER tab) → uses that sheet.
 *  - Otherwise: treats the first sheet as our 9-column export-shape CSV
 *    (Date, Restaurant, Item, Quantity, Unit, Unit Price, Line Total, Status, Notes).
 *
 * Behaviour for each (date, restaurant) group:
 *  - If a delivery already exists for that key → reuse the row, delete its
 *    existing delivery_items, re-insert fresh from the file.
 *  - Otherwise → create a new delivery (status=finalized for legacy import,
 *    or whatever the row's Status column says for CSV import).
 *  - Items matched by name (case-insensitive). Unknown items are skipped
 *    with an error count returned.
 *
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const preview = searchParams.get("preview") === "true";

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false, cellText: true });

  // Auto-detect: any sheet with "DELIVERY" in the name → legacy mode
  const legacySheetName = workbook.SheetNames.find((n) =>
    n.trim().toUpperCase().includes("DELIVERY")
  );
  const isLegacyTracker = Boolean(legacySheetName);

  const sourceSheet = isLegacyTracker
    ? workbook.Sheets[legacySheetName!]
    : workbook.Sheets[workbook.SheetNames[0]];

  if (!sourceSheet) {
    return NextResponse.json({ error: "Empty file — no sheet found" }, { status: 422 });
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sourceSheet, { defval: "", raw: false });

  const lines: ParsedLine[] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;

    // Use the same normalize-insensitive lookup as pick() — survives the
    // " Date " stray-space bug we just fixed for unit price / line total.
    const dateRaw = pick(row, "Date", "Delivery Date", "delivery_date");
    const date = parseDateValue(dateRaw);
    if (!date) {
      skipped.push({ row: rowNum, reason: "unparseable Date" });
      return;
    }

    const restaurant = pick(row, "Restaurant", "Account") || "Press";
    const itemName = pick(row, "Item", "Item Name");
    if (!itemName) {
      skipped.push({ row: rowNum, reason: "missing Item" });
      return;
    }

    const qtyRaw = pick(row, "Quantity", "Qty");
    const quantity = parseFloat(String(qtyRaw).replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      skipped.push({ row: rowNum, reason: `invalid Quantity "${qtyRaw}"` });
      return;
    }

    const unitRaw = pick(row, "Unit") || "ea";
    const unitPrice = parseFloat(String(pick(row, "Unit Price", "Price", "Price Per Unit")).replace(/[^0-9.\-]/g, ""));
    const lineTotal = parseFloat(String(pick(row, "Line Total", "Total")).replace(/[^0-9.\-]/g, ""));

    lines.push({
      date,
      restaurant,
      itemName,
      quantity,
      unit: normalizeUnit(unitRaw),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      lineTotal: Number.isFinite(lineTotal) ? lineTotal : quantity * (Number.isFinite(unitPrice) ? unitPrice : 0),
      status: pick(row, "Status").toLowerCase() || (isLegacyTracker ? "finalized" : "logged"),
      notes: pick(row, "Notes") || "",
    });
  });

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
    return NextResponse.json({
      deliveries: deliveryCount,
      lines: lines.length,
      skipped: skipped.length,
      skippedRows: skipped.slice(0, 10),
      sample,
      format: isLegacyTracker ? "legacy-delivery-tracker" : "deliveries-csv",
    });
  }

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "No valid rows to import", skipped: skipped.length, skippedRows: skipped.slice(0, 10) },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  // Catalog for item name → id matching. We index TWO ways: the simple
  // lowercase-trim form (existing behavior) AND a normalized form that
  // collapses punctuation and whitespace. That second form lets
  // "Tri Point Leek", "Tri-Point Leek", "TRI-POINT LEEK", and
  // "tripointleek" all match the same catalog row — common drift in
  // hand-maintained spreadsheets where the same crop gets typed
  // differently across years.
  const { data: allItems } = await (admin as any).from("items").select("id, name");
  const itemByName: Record<string, string> = {};
  const itemByNorm: Record<string, string> = {};
  for (const item of (allItems ?? []) as Array<{ id: string; name: string }>) {
    itemByName[item.name.toLowerCase().trim()] = item.id;
    const norm = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm) itemByNorm[norm] = item.id;
  }
  /** Try exact lowercase first, then fall back to punct/space-stripped form. */
  function lookupItemId(rawName: string): string | undefined {
    const cleaned = rawName.toLowerCase().trim();
    return itemByName[cleaned] ?? itemByNorm[cleaned.replace(/[^a-z0-9]/g, "")];
  }

  // Restaurants for name → id matching (with first-word fuzzy fallback)
  const { data: allRestaurants } = await (admin as any).from("restaurants").select("id, name");
  const restaurantByName: Record<string, { id: string }> = {};
  for (const r of (allRestaurants ?? []) as Array<{ id: string; name: string }>) {
    restaurantByName[r.name.toLowerCase().trim()] = { id: r.id };
    const words = r.name.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 3 && !restaurantByName[w]) {
        restaurantByName[w] = { id: r.id };
      }
    }
  }
  const fallbackRestaurant = (allRestaurants ?? [])[0];

  let importedDeliveries = 0;
  let importedLines = 0;
  let lineErrors = 0;
  const unknownItems = new Set<string>();
  const unknownRestaurants = new Set<string>();

  for (const [, lineItems] of Object.entries(grouped)) {
    const { date, restaurant, status, notes } = lineItems[0];
    const restKey = restaurant.toLowerCase().trim();
    const restMatch = restaurantByName[restKey] ?? (fallbackRestaurant ? { id: fallbackRestaurant.id } : null);
    if (!restMatch) {
      lineErrors += lineItems.length;
      unknownRestaurants.add(restaurant);
      continue;
    }
    if (!restaurantByName[restKey] && fallbackRestaurant) {
      unknownRestaurants.add(restaurant);
    }

    // Validate status against the deliveries CHECK constraint
    const validStatus = ["pending", "logged", "finalized"].includes(status) ? status : "finalized";

    // Upsert delivery (UNIQUE on (delivery_date, restaurant_id))
    const { data: existing } = await (admin as any)
      .from("deliveries")
      .select("id")
      .eq("delivery_date", date)
      .eq("restaurant_id", restMatch.id)
      .maybeSingle();

    let deliveryId: string;
    if (existing) {
      deliveryId = existing.id;
      // Refresh status + notes, then wipe + reinsert lines
      await (admin as any)
        .from("deliveries")
        .update({ status: validStatus, notes: notes || null })
        .eq("id", deliveryId);
      await (admin as any).from("delivery_items").delete().eq("delivery_id", deliveryId);
    } else {
      const { data: newDel, error: delErr } = await (admin as any)
        .from("deliveries")
        .insert({ restaurant_id: restMatch.id, delivery_date: date, status: validStatus, notes: notes || null })
        .select("id")
        .single();
      if (delErr || !newDel) {
        lineErrors += lineItems.length;
        continue;
      }
      deliveryId = newDel.id;
    }

    // Insert line items; track items that don't exist in catalog
    const insertRows: Array<{ delivery_id: string; item_id: string; quantity: number; unit: string; unit_price: number }> = [];
    for (const li of lineItems) {
      const itemId = lookupItemId(li.itemName);
      if (!itemId) {
        unknownItems.add(li.itemName);
        lineErrors++;
        continue;
      }
      insertRows.push({
        delivery_id: deliveryId,
        item_id: itemId,
        quantity: li.quantity,
        unit: li.unit,
        unit_price: li.unitPrice,
      });
    }

    if (insertRows.length > 0) {
      const { error: rowErr } = await (admin as any).from("delivery_items").insert(insertRows);
      if (rowErr) {
        lineErrors += insertRows.length;
      } else {
        importedLines += insertRows.length;
      }
    }

    importedDeliveries++;
  }

  return NextResponse.json({
    importedDeliveries,
    importedLines,
    lineErrors,
    skipped: skipped.length,
    unknownItems: Array.from(unknownItems).slice(0, 10),
    unknownRestaurants: Array.from(unknownRestaurants).slice(0, 5),
    format: isLegacyTracker ? "legacy-delivery-tracker" : "deliveries-csv",
  });
}
