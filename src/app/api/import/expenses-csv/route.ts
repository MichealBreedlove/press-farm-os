import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

const VALID_CATEGORIES = new Set<string>(EXPENSE_CATEGORIES);

interface ParsedRow {
  id?: string;            // optional — present means update, missing means insert
  date: string;           // YYYY-MM-DD
  vendor: string | null;
  category: string;       // validated
  description: string | null;
  amount: number;
  receipt_url: string | null;
}

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/**
 * Parse a date string into ISO YYYY-MM-DD.
 * Handles: "2026-04-29", "4/29/26", "April 29, 2026", Excel serial numbers.
 */
function parseDate(raw: string): string | null {
  const s = String(raw).trim();
  if (!s) return null;

  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Excel serial number (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    if (num > 1 && num < 100000) {
      const ms = (num - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  // Generic date parse — handles "4/29/26", "April 29, 2026", etc.
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

/**
 * POST /api/import/expenses-csv?preview=true|false
 * Body: multipart/form-data with `file` (.csv or .xlsx).
 * Columns: ID (optional), Date, Vendor, Category, Description, Amount, Receipt URL
 *
 * Rows with an ID are updated in place; rows without ID are inserted.
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

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false, cellText: true, cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    return NextResponse.json({ error: "Empty file — no sheet found" }, { status: 422 });
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });

  const parsed: ParsedRow[] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // 1-indexed + header

    const dateStr = pick(raw, "Date", "date");
    const date = parseDate(dateStr);
    if (!date) {
      skipped.push({ row: rowNum, reason: `unparseable Date "${dateStr}"` });
      return;
    }

    const amountRaw = pick(raw, "Amount", "amount", "Total", "Cost");
    const amount = parseFloat(String(amountRaw).replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(amount)) {
      skipped.push({ row: rowNum, reason: `unparseable Amount "${amountRaw}"` });
      return;
    }

    const categoryRaw = pick(raw, "Category", "category");
    // Normalize: title-case and check enum; default to "Other" if unknown
    const titleCased = categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1).toLowerCase();
    const category = VALID_CATEGORIES.has(titleCased) ? titleCased : "Other";

    const idRaw = pick(raw, "ID", "Id", "id");
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idRaw) ? idRaw : undefined;

    parsed.push({
      id,
      date,
      vendor: pick(raw, "Vendor", "vendor") || null,
      category,
      description: pick(raw, "Description", "description", "Note", "Notes") || null,
      amount,
      receipt_url: pick(raw, "Receipt URL", "Receipt", "ReceiptURL") || null,
    });
  });

  const inserts = parsed.filter((r) => !r.id);
  const updates = parsed.filter((r) => r.id);

  if (preview) {
    return NextResponse.json({
      total: parsed.length,
      newCount: inserts.length,
      updateCount: updates.length,
      skipped: skipped.length,
      skippedRows: skipped.slice(0, 10),
      preview: parsed.slice(0, 20).map((r) => ({
        date: r.date,
        vendor: r.vendor,
        category: r.category,
        description: r.description,
        amount: r.amount,
        isUpdate: Boolean(r.id),
      })),
    });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No valid rows to import", skipped: skipped.length, skippedRows: skipped },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  let imported = 0;
  let updated = 0;
  const errors: { row: string; error: string }[] = [];

  // Inserts (batch)
  if (inserts.length > 0) {
    const payload = inserts.map((r) => ({
      farm_id: farm.id,
      date: r.date,
      vendor: r.vendor,
      category: r.category,
      description: r.description,
      amount: r.amount,
      receipt_url: r.receipt_url,
    }));
    const { error } = await (admin as any).from("farm_expenses").insert(payload);
    if (error) {
      errors.push({ row: `${inserts.length} new rows`, error: error.message });
    } else {
      imported = inserts.length;
    }
  }

  // Updates (one per row to surface per-row errors clearly)
  for (const r of updates) {
    const { error } = await (admin as any)
      .from("farm_expenses")
      .update({
        date: r.date,
        vendor: r.vendor,
        category: r.category,
        description: r.description,
        amount: r.amount,
        receipt_url: r.receipt_url,
      })
      .eq("id", r.id!)
      .eq("farm_id", farm.id);
    if (error) {
      errors.push({ row: `${r.date} · $${r.amount}`, error: error.message });
    } else {
      updated++;
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
