import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import type { ItemCategory } from "@/types";

/**
 * POST /api/import/key-tab?preview=true|false
 * Accepts multipart form with .xlsx file.
 * Parses KEY tab: Item Name, Unit, Price Per Unit.
 * Creates items + price_catalog entries.
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
  const workbook = XLSX.read(buffer, { type: "array" });

  // Find KEY sheet (case-insensitive)
  const keySheetName = workbook.SheetNames.find(
    (n) => n.trim().toUpperCase() === "KEY"
  );
  if (!keySheetName) {
    return NextResponse.json(
      { error: `KEY tab not found. Available tabs: ${workbook.SheetNames.join(", ")}` },
      { status: 422 }
    );
  }

  const sheet = workbook.Sheets[keySheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  // Auto-categorize by keyword matching
  function detectCategory(name: string): ItemCategory {
    const n = name.toLowerCase();
    if (/nasturtium|pansy|viola|borage|marigold|calendula|chive blossom|flower|petal|bloom/.test(n))
      return "flowers";
    if (/micro|shoot|tendril|pea tip|sunflower|radish|beet|cress|amaranth|basil micro/.test(n))
      return "micros_leaves";
    if (/basil|mint|thyme|oregano|rosemary|sage|tarragon|chive|dill|cilantro|parsley|herb|leaf|leaves|sorrel|shiso|perilla/.test(n))
      return "herbs_leaves";
    if (/tomato|pepper|squash|zucchini|cucumber|eggplant|bean|pea|corn|carrot|beet|radish|potato|onion|garlic|leek|kale|chard|spinach|lettuce|arugula|fennel|celery|kohlrabi/.test(n))
      return "fruit_veg";
    if (/kit/.test(n)) return "kits";
    return "herbs_leaves"; // default
  }

  // Normalize unit strings to valid enum values
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

  // Parse rows — handle varied column name conventions
  interface ParsedRow {
    name: string;
    category: ItemCategory;
    unit: string;
    price: number;
    raw: Record<string, unknown>;
  }

  const parsed: ParsedRow[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    // Try common column name variants
    const name = String(
      row["Item Name"] ?? row["item_name"] ?? row["Item"] ?? row["NAME"] ?? ""
    ).trim();
    const unitRaw = String(
      row["Unit"] ?? row["unit"] ?? row["UNIT"] ?? ""
    ).trim();
    const priceRaw =
      row["Price Per Unit"] ?? row["Price"] ?? row["price"] ?? row["PRICE"] ?? 0;
    const price = parseFloat(String(priceRaw).replace(/[^0-9.]/g, ""));

    if (!name || isNaN(price) || price < 0) {
      if (name) skipped.push(name);
      continue;
    }

    parsed.push({
      name,
      category: detectCategory(name),
      unit: normalizeUnit(unitRaw),
      price,
      raw: row,
    });
  }

  if (preview) {
    return NextResponse.json({
      total: parsed.length,
      skipped: skipped.length,
      preview: parsed.slice(0, 20).map((r) => ({
        name: r.name,
        category: r.category,
        unit: r.unit,
        price: r.price,
      })),
    });
  }

  // Import: upsert items + price_catalog
  const admin = createAdminClient();

  // Get farm (single-farm app)
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  let imported = 0;
  let errors = 0;

  for (const row of parsed) {
    // Upsert item by name
    const { data: item, error: itemErr } = await (admin as any)
      .from("items")
      .upsert(
        { farm_id: farm.id, name: row.name, category: row.category, default_unit: row.unit, is_active: true },
        { onConflict: "farm_id,name", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (itemErr || !item) {
      errors++;
      continue;
    }

    // Upsert price_catalog
    const { error: priceErr } = await (admin as any)
      .from("price_catalog")
      .upsert(
        { item_id: item.id, unit: row.unit, price_per_unit: row.price, effective_date: today, source: "market" },
        { onConflict: "item_id,unit,effective_date" }
      );

    if (priceErr) {
      errors++;
      continue;
    }

    imported++;
  }

  return NextResponse.json({ imported, errors, skipped: skipped.length });
}
