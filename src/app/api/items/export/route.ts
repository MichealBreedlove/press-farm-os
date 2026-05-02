import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/items/export?archived=true|false
 *
 * Returns a CSV of every item in the catalog with the same 12-column shape
 * the brand-voice import prompt produces, so it round-trips cleanly:
 *
 *   Name, Category, Variety, Color, Sizes, Containers, Prices,
 *   Default Price, Chef Notes, Internal Notes, Source, Season Status
 *
 * Admin only.
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
  const includeArchived = searchParams.get("archived") === "true";

  const admin = createAdminClient();
  let query = (admin as any)
    .from("items")
    .select(`
      id, name, category, unit_type, default_price, unit_prices,
      chef_notes, internal_notes, source, is_archived, is_event_item, is_press_bar_item, season_status,
      size, variety, color
    `)
    .order("category")
    .order("name");

  if (!includeArchived) query = query.eq("is_archived", false);

  const { data: items, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /** Escape a single CSV field per RFC 4180 (quote if it contains comma, quote, or newline). */
  function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /** Format unit_prices map into "sm:15.00, lg:30.00, ea:1.00" form. */
  function formatPrices(unitPrices: Record<string, number> | null | undefined): string {
    if (!unitPrices || typeof unitPrices !== "object") return "";
    const entries = Object.entries(unitPrices)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .map(([k, v]) => `${k}:${(v as number).toFixed(2)}`);
    return entries.join(", ");
  }

  const headers = [
    "Name", "Category", "Variety", "Color", "Sizes", "Containers",
    "Prices", "Default Price", "Chef Notes", "Internal Notes",
    "Source", "Season Status", "Archived", "Event Item", "Press Bar",
  ];

  const lines: string[] = [headers.join(",")];

  for (const item of (items ?? []) as any[]) {
    // unit_type may be comma-separated ("sm,lg") or a single code
    const containers = String(item.unit_type ?? "")
      .split(",").map((u: string) => u.trim()).filter(Boolean).join(",");

    lines.push([
      csvEscape(item.name),
      csvEscape(item.category),
      csvEscape(item.variety ?? ""),
      csvEscape(item.color ?? ""),
      csvEscape(item.size ?? ""),
      csvEscape(containers),
      csvEscape(formatPrices(item.unit_prices)),
      csvEscape(item.default_price != null ? Number(item.default_price).toFixed(2) : ""),
      csvEscape(item.chef_notes ?? ""),
      csvEscape(item.internal_notes ?? ""),
      csvEscape(item.source ?? ""),
      csvEscape(item.season_status ?? "available"),
      csvEscape(item.is_archived ? "true" : "false"),
      csvEscape(item.is_event_item ? "true" : "false"),
      csvEscape(item.is_press_bar_item ? "true" : "false"),
    ].join(","));
  }

  // RFC 4180 line endings + UTF-8 BOM so Excel renders accents/em-dashes correctly
  const body = "﻿" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="press-farm-items-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
