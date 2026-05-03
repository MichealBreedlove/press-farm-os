/**
 * One-shot full import: items first, then deliveries.
 *
 * Mirrors the logic of /api/import/items-csv and /api/import/deliveries-csv
 * but bypasses Vercel + auth — we use the admin (service-role) client
 * directly. Reports counts and any per-row errors at the end.
 *
 * Run:
 *   npx tsx -r dotenv/config scripts/import-both.ts \
 *     dotenv_config_path=.env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as fs from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing supabase env vars");
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ITEMS_FILE = "C:/Users/mikej/Downloads/Press Farm Items Fixed.csv";
const DELIVERIES_FILE = "C:/Users/mikej/Downloads/Delivery.xlsx";

const VALID_CATEGORIES = new Set(["flowers", "micros_leaves", "herbs_leaves", "fruit_veg", "kits", "family_meal"]);
const VALID_UNITS = new Set(["ea", "sm", "lg", "gb", "lbs", "bu", "qt", "bx", "cs", "pt", "kit"]);
const LEGACY_UNIT_MAP: Record<string, string> = {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeKey(k: string): string {
  return String(k ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row: Record<string, unknown>, ...keys: string[]): string {
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

function parsePrices(raw: string): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const piece of raw.split(",")) {
    const m = piece.trim().match(/^([a-z]+)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
    if (!m) continue;
    const code = m[1].toLowerCase();
    const num = parseFloat(m[2]);
    if (VALID_UNITS.has(code) && Number.isFinite(num) && num >= 0) {
      out[code] = num;
    }
  }
  return out;
}

function normalizeUnit(raw: string): string {
  return LEGACY_UNIT_MAP[String(raw ?? "").trim().toLowerCase()] ?? "ea";
}

function parseDateValue(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    if (num > 0) {
      const d = (XLSX as any).SSF?.parse_date_code?.(num);
      if (d && d.y) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ─── Import items ────────────────────────────────────────────────────────────

async function importItems() {
  console.log("\n📦 Importing items from:", ITEMS_FILE);
  const wb = XLSX.read(fs.readFileSync(ITEMS_FILE), { type: "buffer", raw: false, cellText: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  console.log(`  Read ${rows.length} rows from sheet "${wb.SheetNames[0]}"`);
  console.log(`  Headers: ${Object.keys(rows[0] ?? {}).join(", ")}`);

  // Header repair: the file has "5271" where "Prices" should be — looks like
  // a numeric sample value got pushed into row 1 by mistake. Detect it
  // (values look like "lg:15.00, sm:7.50") and remap that column to "Prices".
  const firstRow = rows[0] ?? {};
  const possiblePricesKey = Object.keys(firstRow).find((k) => {
    const v = String(firstRow[k] ?? "");
    // Real price strings look like "lg:15.00, sm:7.50, ea:0.30"
    return /^[a-z]{1,4}\s*:\s*\d+/i.test(v) && k.toLowerCase() !== "prices";
  });
  if (possiblePricesKey) {
    console.log(`  ⚠ Repairing header: "${possiblePricesKey}" → "Prices"`);
    for (const row of rows) {
      row["Prices"] = row[possiblePricesKey];
      delete row[possiblePricesKey];
    }
  }

  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) throw new Error("No farm row in DB");

  let imported = 0, updated = 0;
  const skipped: string[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const name = pick(raw, "Name", "Item Name", "Item", "Product", "Crop");
    if (!name) { skipped.push(`row ${i + 2}: missing Name`); continue; }

    const catRaw = pick(raw, "Category").toLowerCase().replace(/\s+/g, "_").replace(/&/g, "");
    const category = VALID_CATEGORIES.has(catRaw) ? catRaw : "herbs_leaves";

    const containersRaw = pick(raw, "Containers", "Unit", "Units");
    const containerCodes = containersRaw
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      .filter((u) => VALID_UNITS.has(u));
    const unit_type = (containerCodes.length > 0 ? containerCodes : ["ea"]).join(",");

    const allPrices = parsePrices(pick(raw, "Prices", "Unit Prices"));
    const unit_prices: Record<string, number> = {};
    for (const code of containerCodes) {
      if (typeof allPrices[code] === "number") unit_prices[code] = allPrices[code];
    }

    const dpNum = parseFloat(String(pick(raw, "Default Price", "Price", "Price Per Unit")).replace(/[^0-9.]/g, ""));
    const default_price = Number.isFinite(dpNum) && dpNum >= 0 ? dpNum : null;

    const archivedRaw = pick(raw, "Archived").toLowerCase();
    const is_archived = archivedRaw === "true" || archivedRaw === "yes" || archivedRaw === "1";
    const eventRaw = pick(raw, "Event Item", "EventItem", "Event").toLowerCase();
    const is_event_item = eventRaw === "true" || eventRaw === "yes" || eventRaw === "1";
    const pressBarRaw = pick(raw, "Press Bar", "PressBar", "Press Bar Item", "PressBarItem", "Bar").toLowerCase();
    const is_press_bar_item = pressBarRaw === "true" || pressBarRaw === "yes" || pressBarRaw === "1";

    const seasonRaw = pick(raw, "Season Status").toLowerCase().replace(/\s+/g, "_");
    const season_status = ["available", "ending_soon", "coming_soon", "out_of_season"].includes(seasonRaw) ? seasonRaw : "available";

    const payload = {
      farm_id: farm.id,
      name,
      category,
      unit_type,
      unit_prices,
      default_price,
      chef_notes: pick(raw, "Chef Notes") || null,
      internal_notes: pick(raw, "Internal Notes") || null,
      source: pick(raw, "Source") || null,
      season_status,
      is_archived,
      is_event_item,
      is_press_bar_item,
      size: pick(raw, "Sizes", "Size") || null,
      variety: pick(raw, "Variety") || null,
      color: pick(raw, "Color", "Colors") || null,
    };

    const { data: existing } = await (admin as any).from("items").select("id").eq("farm_id", farm.id).eq("name", name).maybeSingle();
    const { error } = await (admin as any).from("items").upsert(payload, { onConflict: "farm_id,name", ignoreDuplicates: false });
    if (error) {
      errors.push({ name, error: error.message });
    } else if (existing) {
      updated++;
    } else {
      imported++;
    }
  }

  console.log(`  ✓ Items: ${imported} new · ${updated} updated · ${skipped.length} skipped · ${errors.length} errors`);
  if (skipped.length > 0) for (const s of skipped.slice(0, 10)) console.log(`    skipped: ${s}`);
  if (errors.length > 0) for (const e of errors.slice(0, 10)) console.log(`    error: ${e.name}: ${e.error}`);
}

// ─── Import deliveries ──────────────────────────────────────────────────────

async function importDeliveries() {
  console.log("\n🚚 Importing deliveries from:", DELIVERIES_FILE);
  const wb = XLSX.read(fs.readFileSync(DELIVERIES_FILE), { type: "buffer", cellDates: true, raw: false, cellText: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  console.log(`  Read ${rows.length} rows from sheet "${wb.SheetNames[0]}"`);

  // Indexes
  const { data: allItems } = await (admin as any).from("items").select("id, name");
  const itemByName: Record<string, string> = {};
  const itemByNorm: Record<string, string> = {};
  for (const it of (allItems ?? []) as Array<{ id: string; name: string }>) {
    itemByName[it.name.toLowerCase().trim()] = it.id;
    const norm = it.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm) itemByNorm[norm] = it.id;
  }
  function lookupItemId(rawName: string): string | undefined {
    const cleaned = rawName.toLowerCase().trim();
    return itemByName[cleaned] ?? itemByNorm[cleaned.replace(/[^a-z0-9]/g, "")];
  }

  const { data: allRest } = await (admin as any).from("restaurants").select("id, name");
  const restByName: Record<string, { id: string }> = {};
  const restByFirstWord: Record<string, { id: string }> = {};
  for (const r of (allRest ?? []) as Array<{ id: string; name: string }>) {
    restByName[r.name.toLowerCase().trim()] = { id: r.id };
    const first = r.name.toLowerCase().split(/[\s-]/)[0];
    if (first) restByFirstWord[first] = { id: r.id };
  }
  const fallback = (allRest ?? [])[0];

  // Parse all rows into line items
  type LI = { date: string; restaurant: string; itemName: string; quantity: number; unit: string; unitPrice: number; status: string; notes: string };
  const lines: LI[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const date = parseDateValue(pick(row, "Date", "Delivery Date"));
    if (!date) { skippedRows.push({ row: rowNum, reason: "unparseable Date" }); continue; }
    const restaurant = pick(row, "Restaurant", "Account") || "Press";
    const itemName = pick(row, "Item", "Item Name");
    if (!itemName) { skippedRows.push({ row: rowNum, reason: "missing Item" }); continue; }
    const quantity = parseFloat(String(pick(row, "Quantity", "Qty")).replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(quantity) || quantity <= 0) { skippedRows.push({ row: rowNum, reason: "invalid Quantity" }); continue; }
    const unitRaw = pick(row, "Unit");
    const unitPrice = parseFloat(String(pick(row, "Unit Price", "Price", "Price Per Unit")).replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) { skippedRows.push({ row: rowNum, reason: "invalid Unit Price" }); continue; }
    lines.push({
      date,
      restaurant,
      itemName,
      quantity,
      unit: normalizeUnit(unitRaw),
      unitPrice,
      status: (pick(row, "Status").toLowerCase() || "finalized"),
      notes: pick(row, "Notes"),
    });
  }
  console.log(`  Parsed ${lines.length} valid line items, ${skippedRows.length} skipped`);

  // Group by (date, restaurant)
  const grouped: Record<string, LI[]> = {};
  for (const li of lines) {
    const key = `${li.date}::${li.restaurant.toLowerCase().trim()}`;
    (grouped[key] ??= []).push(li);
  }

  let importedDeliveries = 0;
  let importedLines = 0;
  let lineErrors = 0;
  const unknownItems = new Set<string>();
  const unknownRestaurants = new Set<string>();

  for (const [, lineItems] of Object.entries(grouped)) {
    const { date, restaurant, status, notes } = lineItems[0];
    const restKey = restaurant.toLowerCase().trim();
    const rest =
      restByName[restKey] ??
      restByFirstWord[restKey.split(/[\s-]/)[0]] ??
      (fallback ? { id: fallback.id } : null);
    if (!rest) {
      lineErrors += lineItems.length;
      unknownRestaurants.add(restaurant);
      continue;
    }
    if (!restByName[restKey]) unknownRestaurants.add(restaurant);

    const validStatus = ["pending", "logged", "finalized"].includes(status) ? status : "finalized";

    // Ensure delivery_dates row exists for this date — without it, the
    // delivery still inserts but the date won't show up on calendar views
    const { data: dateRow } = await (admin as any)
      .from("delivery_dates").select("id").eq("date", date).maybeSingle();
    if (!dateRow) {
      const dow = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
      await (admin as any).from("delivery_dates").insert({ date, day_of_week: dow, ordering_open: false });
    }

    // Upsert delivery
    const { data: existing } = await (admin as any)
      .from("deliveries").select("id").eq("delivery_date", date).eq("restaurant_id", rest.id).maybeSingle();
    let deliveryId: string;
    if (existing) {
      deliveryId = existing.id;
      await (admin as any).from("deliveries").update({ status: validStatus, notes: notes || null }).eq("id", deliveryId);
      await (admin as any).from("delivery_items").delete().eq("delivery_id", deliveryId);
    } else {
      const { data: newDel, error } = await (admin as any).from("deliveries").insert({
        restaurant_id: rest.id,
        delivery_date: date,
        status: validStatus,
        notes: notes || null,
      }).select("id").single();
      if (error || !newDel) {
        lineErrors += lineItems.length;
        continue;
      }
      deliveryId = newDel.id;
    }

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
      const { error } = await (admin as any).from("delivery_items").insert(insertRows);
      if (error) {
        lineErrors += insertRows.length;
        console.log(`    ✗ delivery_items insert for ${date}/${restaurant}: ${error.message}`);
      } else {
        importedLines += insertRows.length;
      }
    }
    importedDeliveries++;
  }

  console.log(`  ✓ Deliveries: ${importedDeliveries} · Line items: ${importedLines} · Errors: ${lineErrors}`);
  if (unknownItems.size > 0) {
    console.log(`  ⚠ Unknown item names (${unknownItems.size}):`);
    for (const u of [...unknownItems].slice(0, 30)) console.log(`    - ${u}`);
  }
  if (unknownRestaurants.size > 0) {
    console.log(`  ⚠ Unknown restaurants (${unknownRestaurants.size}):`);
    for (const u of unknownRestaurants) console.log(`    - ${u}`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("\n🌱 Press Farm full import\n");
  await importItems();
  await importDeliveries();
  console.log("\n✅ Done.\n");
})().catch((err) => {
  console.error("\n❌ import-both failed:", err);
  process.exit(1);
});
