/**
 * Standalone Excel import script.
 * Reads the Daily Delivery Tracking Sheet directly and imports:
 *   1. KEY tab → items + price_catalog
 *   2. DELIVERY TRACKER tab → deliveries + delivery_items
 *
 * Run: npx tsx scripts/import-excel.ts
 */

import path from "path";
import { config } from "dotenv";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

// Load env
const envPaths = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "../../../.env.local"),
];
for (const p of envPaths) {
  if (!config({ path: p }).error) { console.log(`Loaded env: ${p}`); break; }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceKey) { console.error("Missing env vars"); process.exit(1); }

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FILE = "C:\\Users\\mikej\\Downloads\\OneDrive_2_4-5-2026\\All Recipes + Kitchen Documents\\1.9 - Farm & Preservation\\Daily Delivery Tracking Sheet (DO NOT MODIFY).xlsx";
const today = new Date().toISOString().slice(0, 10);

// ---- Category detection ----
type ItemCategory = "flowers" | "micros_leaves" | "herbs_leaves" | "fruit_veg" | "kits";
function detectCategory(name: string): ItemCategory {
  const n = name.toLowerCase();
  if (/nasturtium|pansy|viola|borage|marigold|calendula|chive blossom|flower|petal|bloom/.test(n)) return "flowers";
  if (/micro|shoot|tendril|pea tip|sunflower|radish|beet|cress|amaranth|basil micro/.test(n)) return "micros_leaves";
  if (/basil|mint|thyme|oregano|rosemary|sage|tarragon|chive|dill|cilantro|parsley|herb|leaf|leaves|sorrel|shiso|perilla/.test(n)) return "herbs_leaves";
  if (/tomato|pepper|squash|zucchini|cucumber|eggplant|bean|pea|corn|carrot|beet|radish|potato|onion|garlic|leek|kale|chard|spinach|lettuce|arugula|fennel|celery|kohlrabi/.test(n)) return "fruit_veg";
  if (/kit/.test(n)) return "kits";
  return "herbs_leaves";
}

// ---- Unit normalization ----
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
  return UNIT_MAP[String(raw).trim().toLowerCase()] ?? "ea";
}

async function importKeyTab(wb: XLSX.WorkBook) {
  console.log("\n=== KEY Tab Import ===");
  const sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === "KEY");
  if (!sheetName) { console.log("KEY tab not found. Tabs:", wb.SheetNames.join(", ")); return; }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
  console.log(`Rows found: ${rows.length}`);

  // Get farm
  const { data: farm } = await admin.from("farms").select("id").single();
  if (!farm) { console.error("No farm found"); return; }

  let imported = 0, errors = 0, skipped = 0;
  for (const row of rows) {
    const name = String(row["Item Name"] ?? row["item_name"] ?? row["Item"] ?? row["NAME"] ?? row["Farm Expense Key"] ?? "").trim();
    const unitRaw = String(row["Unit"] ?? row["unit"] ?? "").trim();
    const priceRaw = String(row["Price Per Unit"] ?? row["Price"] ?? row["price"] ?? "0").replace(/[^0-9.]/g, "");
    const price = parseFloat(priceRaw);

    if (!name || isNaN(price)) { if (name) skipped++; continue; }

    // No unique constraint on (farm_id, name) — select-then-insert/update
    const { data: existing } = await admin.from("items" as any).select("id").eq("farm_id", farm.id).eq("name", name).maybeSingle();
    let item: { id: string } | null = existing as any;
    if (!item) {
      const { data: newItem, error: insErr } = await admin.from("items" as any)
        .insert({ farm_id: farm.id, name, category: detectCategory(name), unit_type: normalizeUnit(unitRaw), is_archived: false })
        .select("id").single();
      if (insErr || !newItem) { errors++; console.error(`  Item insert error [${name}]:`, insErr?.message); continue; }
      item = newItem as any;
    } else {
      await admin.from("items" as any).update({ category: detectCategory(name), unit_type: normalizeUnit(unitRaw) }).eq("id", (item as any).id);
    }

    const { error: priceErr } = await admin
      .from("price_catalog" as any)
      .upsert(
        { item_id: (item as any).id, unit: normalizeUnit(unitRaw), price_per_unit: price, effective_date: today, source: "market" },
        { onConflict: "item_id,unit,effective_date" }
      );

    if (priceErr) { errors++; console.error(`  Price error [${name}]:`, priceErr.message); continue; }
    imported++;
  }
  console.log(`Done: ${imported} imported, ${errors} errors, ${skipped} skipped`);
}

async function importDeliveryHistory(wb: XLSX.WorkBook) {
  console.log("\n=== Delivery History Import ===");
  const sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase().includes("DELIVERY"));
  if (!sheetName) { console.log("Delivery tab not found. Tabs:", wb.SheetNames.join(", ")); return; }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", cellDates: true } as any);
  console.log(`Rows found: ${rows.length}`);

  // Load item catalog for name matching
  const { data: allItems } = await admin.from("items" as any).select("id, name");
  const itemByName: Record<string, string> = {};
  for (const i of allItems ?? []) itemByName[(i as any).name.toLowerCase().trim()] = (i as any).id;

  // Load restaurants
  const { data: allRestaurants } = await admin.from("restaurants" as any).select("id, name, farm_id");
  const restaurantByName: Record<string, { id: string; farm_id: string }> = {};
  for (const r of allRestaurants ?? []) {
    restaurantByName[(r as any).name.toLowerCase().trim()] = { id: (r as any).id, farm_id: (r as any).farm_id };
    for (const w of (r as any).name.toLowerCase().split(/\s+/)) {
      if (w.length > 3 && !restaurantByName[w]) restaurantByName[w] = { id: (r as any).id, farm_id: (r as any).farm_id };
    }
  }
  const fallback = allRestaurants?.[0] as any;

  function parseDate(raw: unknown): string | null {
    if (!raw) return null;
    if (raw instanceof Date) return raw.toISOString().slice(0, 10);
    const num = Number(raw);
    if (!isNaN(num) && num > 40000) {
      const d = XLSX.SSF.parse_date_code(num);
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    const d = new Date(String(raw));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  interface Line { date: string; restaurant: string; itemName: string; quantity: number; unit: string; unitPrice: number; lineTotal: number; }
  const lines: Line[] = [];

  // Date only appears on first row of each delivery group — carry forward
  let currentDate: string | null = null;
  for (const row of rows) {
    const rawDate = row["Date"] ?? row["date"] ?? row["DATE"] ?? row["Delivery Date"];
    const parsedDate = parseDate(rawDate);
    if (parsedDate) currentDate = parsedDate;
    if (!currentDate) continue;

    // Item name is in the unlabeled column "__EMPTY", fallback to labeled variants
    const restaurant = String(row["Restaurant"] ?? row["restaurant"] ?? row["Account"] ?? "Press").trim();
    const itemName = String(row["__EMPTY"] ?? row["Item"] ?? row["item"] ?? row["Item Name"] ?? row["item_name"] ?? "").trim();
    const quantity = parseFloat(String(row["Quantity"] ?? row["Qty"] ?? row["qty"] ?? "0"));
    const unitRaw = String(row["Unit"] ?? row["unit"] ?? "ea").trim();
    // Column headers have leading/trailing spaces
    const unitPrice = parseFloat(String(row[" Price "] ?? row["Price"] ?? row["Unit Price"] ?? row["Price Per Unit"] ?? "0").replace(/[^0-9.]/g, ""));
    const lineTotal = parseFloat(String(row[" Total "] ?? row["Total"] ?? row["Line Total"] ?? "0").replace(/[^0-9.]/g, ""));

    if (!itemName || isNaN(quantity) || quantity <= 0) continue;
    lines.push({ date: currentDate, restaurant, itemName, quantity, unit: normalizeUnit(unitRaw), unitPrice: isNaN(unitPrice) ? 0 : unitPrice, lineTotal: isNaN(lineTotal) ? quantity * (isNaN(unitPrice) ? 0 : unitPrice) : lineTotal });
  }

  // Group by date + restaurant
  const grouped: Record<string, Line[]> = {};
  for (const l of lines) {
    const key = `${l.date}::${l.restaurant}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(l);
  }

  console.log(`Groups (deliveries): ${Object.keys(grouped).length}, lines: ${lines.length}`);

  let importedDeliveries = 0, importedLines = 0, lineErrors = 0, skippedItems = 0;
  for (const [, lineItems] of Object.entries(grouped)) {
    const { date, restaurant } = lineItems[0];
    const restKey = restaurant.toLowerCase().trim();
    const restMatch = restaurantByName[restKey] ?? (fallback ? { id: fallback.id, farm_id: fallback.farm_id } : null);
    if (!restMatch) { lineErrors += lineItems.length; continue; }

    const { data: existing } = await admin.from("deliveries" as any).select("id").eq("delivery_date", date).eq("restaurant_id", restMatch.id).maybeSingle();
    let deliveryId: string;
    if (existing) {
      deliveryId = (existing as any).id;
      await admin.from("delivery_items" as any).delete().eq("delivery_id", deliveryId);
    } else {
      const { data: newDel, error: delErr } = await admin.from("deliveries" as any)
        .insert({ restaurant_id: restMatch.id, delivery_date: date, status: "finalized" })
        .select("id").single();
      if (delErr || !newDel) { lineErrors += lineItems.length; console.error(`  Delivery insert error [${date}/${restaurant}]:`, delErr?.message); continue; }
      deliveryId = (newDel as any).id;
    }

    const itemRows = lineItems.map((li) => {
      const itemId = itemByName[li.itemName.toLowerCase().trim()];
      if (!itemId) { skippedItems++; return null; }
      return { delivery_id: deliveryId, item_id: itemId, quantity: li.quantity, unit: li.unit, unit_price: li.unitPrice };
    }).filter(Boolean);

    if (itemRows.length > 0) {
      const { error } = await admin.from("delivery_items" as any).insert(itemRows);
      if (error) { lineErrors += itemRows.length; console.error("  Line error:", error.message); }
      else importedLines += itemRows.length;
    }
    importedDeliveries++;
  }
  console.log(`Done: ${importedDeliveries} deliveries, ${importedLines} lines, ${lineErrors} errors, ${skippedItems} items not in catalog`);
}

// ---- Expense category detection ----
// Valid: Seeds, Soil, Amendments, Equipment, Gas, Transport, Supplies, Labor, Other
function detectExpenseCategory(item: string): string {
  const n = item.toLowerCase();
  if (/seed/.test(n)) return "Seeds";
  if (/coir|perlite|soil|compost|substrate|mix/.test(n)) return "Soil";
  if (/amendment|fertilizer|nutrient|lime|sulfur/.test(n)) return "Amendments";
  if (/timer|tool|equipment|tiller|pump|bag|pot|tray|greenhouse|hardware|part|filter|tube|hose|sprinkler|irrigation/.test(n)) return "Equipment";
  if (/gas|fuel|propane/.test(n)) return "Gas";
  if (/transport|delivery|shipping|freight/.test(n)) return "Transport";
  if (/supply|supplies|label|tape|box|packaging|bag|glove|sanitiz/.test(n)) return "Supplies";
  if (/labor|worker|wage|pay|salary/.test(n)) return "Labor";
  return "Other";
}

async function importFarmExpenses(wb: XLSX.WorkBook) {
  console.log("\n=== Farm Expenses Import ===");
  const sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase().includes("FARM EXPENSE"));
  if (!sheetName) { console.log("FARM EXPENSES tab not found. Tabs:", wb.SheetNames.join(", ")); return; }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", cellDates: true } as any);
  console.log(`Rows found: ${rows.length}`);

  // Row 0 has header names as values (FARM EXPENSE TRACKER = "DATE", __EMPTY = "ITEM", etc.)
  // Skip row 0 and any row where the date column is the string "DATE"
  const { data: farm } = await admin.from("farms").select("id").single();
  if (!farm) { console.error("No farm found"); return; }

  function parseDate(raw: unknown): string | null {
    if (!raw) return null;
    if (raw instanceof Date) return raw.toISOString().slice(0, 10);
    const s = String(raw).trim();
    if (s === "DATE" || s === "") return null;
    const num = Number(raw);
    if (!isNaN(num) && num > 40000) {
      const d = XLSX.SSF.parse_date_code(num);
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  let imported = 0, errors = 0, skipped = 0;
  for (const row of rows) {
    const date = parseDate(row["FARM EXPENSE TRACKER"] ?? row["Date"] ?? row["DATE"] ?? "");
    if (!date) { skipped++; continue; }

    const itemName = String(row["__EMPTY"] ?? row["Item"] ?? row["ITEM"] ?? "").trim();
    const vendor = String(row["__EMPTY_1"] ?? row["Vendor"] ?? "").trim();
    const details = String(row["__EMPTY_2"] ?? row["Details"] ?? row["Description"] ?? "").trim();
    const amountRaw = row["__EMPTY_3"] ?? row["Amount"] ?? row["AMOUNT"] ?? 0;
    const amount = parseFloat(String(amountRaw).replace(/[^0-9.]/g, ""));

    if (!itemName || isNaN(amount) || amount <= 0) { skipped++; continue; }

    const description = [itemName, vendor, details].filter(Boolean).join(" — ");
    const category = detectExpenseCategory(itemName);

    const { error } = await admin.from("farm_expenses" as any).insert({
      farm_id: (farm as any).id,
      date,
      category,
      description,
      amount,
    });

    if (error) { errors++; console.error(`  Expense error [${date}/${itemName}]:`, error.message); }
    else imported++;
  }
  console.log(`Done: ${imported} imported, ${errors} errors, ${skipped} skipped`);
}

async function main() {
  console.log("Reading:", FILE);
  const wb = XLSX.readFile(FILE, { cellDates: true });
  console.log("Tabs:", wb.SheetNames.join(", "));

  await importKeyTab(wb);
  await importDeliveryHistory(wb);
  await importFarmExpenses(wb);

  console.log("\nAll done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
