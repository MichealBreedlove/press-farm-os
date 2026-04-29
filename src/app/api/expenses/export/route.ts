import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/expenses/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a CSV of farm_expenses. Optional date range filter.
 * Format round-trips with the matching expenses-csv importer:
 *
 *   ID, Date, Vendor, Category, Description, Amount, Receipt URL
 *
 * The ID column lets re-imports update existing rows in place. New rows
 * (no ID) are inserted. Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const admin = createAdminClient();
  let query = (admin as any)
    .from("farm_expenses")
    .select("id, date, vendor, category, description, amount, receipt_url")
    .order("date", { ascending: false });

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("date", from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte("date", to);

  const { data: expenses, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const headers = ["ID", "Date", "Vendor", "Category", "Description", "Amount", "Receipt URL"];
  const lines: string[] = [headers.join(",")];

  for (const e of (expenses ?? []) as any[]) {
    lines.push([
      csvEscape(e.id),
      csvEscape(e.date),
      csvEscape(e.vendor ?? ""),
      csvEscape(e.category ?? ""),
      csvEscape(e.description ?? ""),
      csvEscape(e.amount != null ? Number(e.amount).toFixed(2) : ""),
      csvEscape(e.receipt_url ?? ""),
    ].join(","));
  }

  // RFC 4180 + UTF-8 BOM (so Excel renders accents correctly)
  const body = "﻿" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="press-farm-expenses-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
