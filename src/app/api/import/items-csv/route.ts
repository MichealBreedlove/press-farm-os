import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { ITEM_CATEGORIES, UNIT_TYPES, SEASON_STATUSES } from "@/lib/constants";
import type { ItemCategory } from "@/types";

const VALID_CATEGORIES = new Set(ITEM_CATEGORIES.map((c) => c.value));
const VALID_UNITS = new Set(UNIT_TYPES.map((u) => u.value));
const VALID_SEASONS = new Set(SEASON_STATUSES.map((s) => s.value));

interface ParsedRow {
  name: string;
  category: ItemCategory;
  variety: string | null;
  color: string | null;
  size: string | null;
  unit_type: string;             // comma-separated, validated
  unit_prices: Record<string, number>;
  default_price: number | null;
  chef_notes: string | null;
  internal_notes: string | null;
  source: string | null;
  season_status: string;
  is_archived: boolean;
}

/** Normalize header keys: trim, lowercase, collapse whitespace. */
function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parsePricesField(raw: string): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const piece of raw.split(",")) {
    const m = piece.trim().match(/^([a-z]+)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
    if (!m) continue;
    const code = m[1].toLowerCase();
    const num = parseFloat(m[2]);
    if (VALID_UNITS.has(code as any) && Number.isFinite(num) && num >= 0) {
      out[code] = num;
    }
  }
  return out;
}

/**
 * POST /api/import/items-csv?preview=true|false
 * Accepts multipart/form-data with a CSV file (also accepts XLSX for convenience).
 * Expected columns (case-sensitive but auto-trimmed):
 *   Name, Category, Variety, Color, Sizes, Containers, Prices,
 *   Default Price, Chef Notes, Internal Notes, Source, Season Status, [Archived]
 *
 * Upserts by (farm_id, name): existing rows are updated, new ones inserted.
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const preview = searchParams.get("preview") === "true";

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  // SheetJS handles both CSV and XLSX; first sheet is used for both.
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false, cellText: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    return NextResponse.json({ error: "Empty file — no sheet found" }, { status: 422 });
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

  const parsed: ParsedRow[] = [];
  const skipped: { row: number; name: string; reason: string }[] = [];

  rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // +1 for 1-indexed, +1 for header row

    const name = pick(raw, "Name", "Item Name", "Item");
    if (!name) {
      skipped.push({ row: rowNum, name: "(blank)", reason: "missing Name" });
      return;
    }

    // Category — validate against enum, default to herbs_leaves if missing/invalid
    const categoryRaw = pick(raw, "Category").toLowerCase().replace(/\s+/g, "_").replace(/&/g, "");
    const category = (VALID_CATEGORIES.has(categoryRaw as any) ? categoryRaw : "herbs_leaves") as ItemCategory;

    // Containers — comma-separated valid unit codes; default to "ea" if none present
    const containersRaw = pick(raw, "Containers", "Unit", "Units");
    const containerCodes = containersRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((u) => VALID_UNITS.has(u as any));
    const unit_type = (containerCodes.length > 0 ? containerCodes : ["ea"]).join(",");

    // Per-unit prices — keep only entries whose code is in the selected containers
    const pricesField = pick(raw, "Prices", "Unit Prices");
    const unit_prices_all = parsePricesField(pricesField);
    const unit_prices: Record<string, number> = {};
    for (const code of containerCodes) {
      if (typeof unit_prices_all[code] === "number") unit_prices[code] = unit_prices_all[code];
    }

    // Default price (fallback)
    const dpRaw = pick(raw, "Default Price", "Price", "Price Per Unit");
    const dpNum = parseFloat(String(dpRaw).replace(/[^0-9.]/g, ""));
    const default_price = Number.isFinite(dpNum) && dpNum >= 0 ? dpNum : null;

    // Season status — validate or default
    const seasonRaw = pick(raw, "Season Status", "Status").toLowerCase().replace(/\s+/g, "_");
    const season_status = VALID_SEASONS.has(seasonRaw as any) ? seasonRaw : "available";

    // Archived flag
    const archivedRaw = pick(raw, "Archived").toLowerCase();
    const is_archived = archivedRaw === "true" || archivedRaw === "yes" || archivedRaw === "1";

    parsed.push({
      name,
      category,
      variety: pick(raw, "Variety") || null,
      color: pick(raw, "Color", "Colors") || null,
      size: pick(raw, "Sizes", "Size") || null,
      unit_type,
      unit_prices,
      default_price,
      chef_notes: pick(raw, "Chef Notes", "ChefNotes") || null,
      internal_notes: pick(raw, "Internal Notes", "InternalNotes") || null,
      source: pick(raw, "Source") || null,
      season_status,
      is_archived,
    });
  });

  if (preview) {
    return NextResponse.json({
      total: parsed.length,
      skipped: skipped.length,
      skippedRows: skipped.slice(0, 10),
      preview: parsed.slice(0, 20).map((r) => ({
        name: r.name,
        category: r.category,
        unit_type: r.unit_type,
        prices: r.unit_prices,
        default_price: r.default_price,
        size: r.size,
      })),
    });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "No valid rows to import", skipped: skipped.length, skippedRows: skipped }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  let imported = 0;
  let updated = 0;
  const errors: { name: string; error: string }[] = [];

  for (const row of parsed) {
    // Check existence to count imports vs updates accurately
    const { data: existing } = await (admin as any)
      .from("items").select("id").eq("farm_id", farm.id).eq("name", row.name).maybeSingle();

    const payload = {
      farm_id: farm.id,
      name: row.name,
      category: row.category,
      unit_type: row.unit_type,
      unit_prices: row.unit_prices,
      default_price: row.default_price,
      chef_notes: row.chef_notes,
      internal_notes: row.internal_notes,
      source: row.source,
      season_status: row.season_status,
      is_archived: row.is_archived,
      size: row.size,
      variety: row.variety,
      color: row.color,
    };

    const { error } = await (admin as any)
      .from("items")
      .upsert(payload, { onConflict: "farm_id,name", ignoreDuplicates: false });

    if (error) {
      errors.push({ name: row.name, error: error.message });
    } else if (existing) {
      updated++;
    } else {
      imported++;
    }
  }

  return NextResponse.json({
    total: parsed.length,
    imported,
    updated,
    skipped: skipped.length,
    errors: errors.length,
    errorDetails: errors.slice(0, 10),
  });
}
