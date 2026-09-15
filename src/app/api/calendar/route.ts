import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { getCalendarMonth } from "@/lib/calendar/fetch";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar?year=2026&month=9
 *
 * One month of admin-calendar data (delivery dates, orders, deliveries,
 * tasks, notes, event requests, labor, harvest forecast) folded per day.
 * Backs the client-side month navigation + day panel on /admin/calendar,
 * so paging months and refreshing after a quick action never reloads the page.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: "year (2000–2100) and month (1–12) required" }, { status: 400 });
  }

  try {
    const data = await getCalendarMonth(year, month);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[CALENDAR] month fetch failed", err);
    return NextResponse.json({ error: "Calendar fetch failed" }, { status: 500 });
  }
}
