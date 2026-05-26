import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import { sendPartnerReportEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";
import type { PartnerReportLine } from "@/emails/partner-report";
import type { ForecastEmailEntry } from "@/emails/availability-forecast";

type Period = "monthly" | "quarterly";

/**
 * Partner / Chef Phil report (monthly + quarterly).
 *
 *   GET  — Vercel Cron (`0 9 1 * *`, the 1st of every month). Requires
 *          `Authorization: Bearer ${CRON_SECRET}` (fail-closed in prod, allow
 *          unsigned in local dev). The handler decides what to send:
 *            • always the previous MONTH's summary on the 1st
 *            • additionally the previous QUARTER's summary when the 1st starts
 *              a quarter (Jan/Apr/Jul/Oct 1).
 *   POST — Manual admin trigger. Body: { period: 'monthly' | 'quarterly' }.
 *
 * Recipient is read from farm_settings.email_partner_report. If unset, the send
 * is skipped and a clear message is returned (graceful no-op).
 *
 * Reuses the deliveries + farm-reports query shapes from /api/reports/income +
 * /api/reports/monthly, but the email is partner-facing — no expense/margin.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected) {
    if (authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }

  // Cron fires on the 1st. Always send the previous month; additionally send the
  // previous quarter when the 1st begins a new quarter.
  const now = new Date();
  const month = now.getMonth(); // 0-based
  const periods: Period[] = ["monthly"];
  if (month % 3 === 0) periods.push("quarterly"); // Jan/Apr/Jul/Oct

  const results: Record<string, unknown> = {};
  for (const period of periods) {
    results[period] = await buildAndSend(period);
  }
  return NextResponse.json({ success: true, results });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const period: Period = body?.period === "quarterly" ? "quarterly" : "monthly";
  const result = await buildAndSend(period);
  return NextResponse.json({ success: true, period, ...(result as object) });
}

/**
 * Resolve the [start, end] ISO date range + a human label for the period that
 * just CLOSED relative to today (previous month / previous quarter).
 */
function resolvePeriod(period: Period): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth(); // 0-based, current month

  if (period === "monthly") {
    // Previous calendar month.
    const prev = new Date(year, monthIdx - 1, 1);
    const y = prev.getFullYear();
    const m = prev.getMonth(); // 0-based
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const label = prev.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { start, end, label };
  }

  // Previous calendar quarter.
  const currentQuarter = Math.floor(monthIdx / 3); // 0-3
  let qYear = year;
  let prevQuarter = currentQuarter - 1;
  if (prevQuarter < 0) {
    prevQuarter = 3;
    qYear = year - 1;
  }
  const startMonth = prevQuarter * 3; // 0-based
  const endMonth = startMonth + 2;
  const start = `${qYear}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(qYear, endMonth + 1, 0).getDate();
  const end = `${qYear}-${String(endMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = `Q${prevQuarter + 1} ${qYear}`;
  return { start, end, label };
}

async function buildAndSend(period: Period) {
  const admin = createAdminClient();

  // Partner recipient from farm_settings — graceful skip when unset.
  const { data: setting } = await (admin as any)
    .from("farm_settings")
    .select("value")
    .eq("key", "email_partner_report")
    .maybeSingle();

  const toEmail: string | null = setting?.value || null;
  const { start, end, label } = resolvePeriod(period);

  if (!toEmail) {
    return {
      skipped: true,
      message: "No partner report email configured. Set it in Settings → Email Settings (Partner / Chef Phil Report).",
      period,
      periodLabel: label,
    };
  }

  // Deliveries in the period (value + restaurant). Mirrors /api/reports/income.
  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select("id, delivery_date, total_value, restaurants(name)")
    .gte("delivery_date", start)
    .lte("delivery_date", end);

  const deliveryRows = deliveries ?? [];
  const totalValue = deliveryRows.reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);
  const deliveryCount = deliveryRows.length;

  // By-restaurant breakdown.
  const byRestaurantMap: Record<string, number> = {};
  for (const d of deliveryRows) {
    const name = (d.restaurants as any)?.name ?? "Unknown";
    byRestaurantMap[name] = (byRestaurantMap[name] ?? 0) + (d.total_value ?? 0);
  }
  const byRestaurant: PartnerReportLine[] = Object.entries(byRestaurantMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: formatCurrency(value) }));

  // Top crops by total delivered value over the period.
  const deliveryIds = deliveryRows.map((d: any) => d.id).filter(Boolean);
  const topItems: PartnerReportLine[] = [];
  if (deliveryIds.length > 0) {
    const { data: items } = await (admin as any)
      .from("delivery_items")
      .select("quantity, unit, line_total, items(name)")
      .in("delivery_id", deliveryIds);

    const itemMap: Record<string, { value: number; qty: number; unit: string | null }> = {};
    for (const it of items ?? []) {
      const name = (it.items as any)?.name ?? "Item";
      const lineValue = it.line_total ?? 0;
      if (!itemMap[name]) itemMap[name] = { value: 0, qty: 0, unit: it.unit ?? null };
      itemMap[name].value += lineValue;
      itemMap[name].qty += it.quantity ?? 0;
    }
    for (const [name, agg] of Object.entries(itemMap).sort((a, b) => b[1].value - a[1].value).slice(0, 8)) {
      topItems.push({
        label: name,
        value: formatCurrency(agg.value),
        sub: `${agg.qty % 1 === 0 ? agg.qty : agg.qty.toFixed(1)}${agg.unit ? ` ${agg.unit.toUpperCase()}` : ""}`,
      });
    }
  }

  // Forward-looking teaser — next 2wk + 4wk windows from the availability forecast.
  const today = new Date().toISOString().slice(0, 10);
  let comingSoon: ForecastEmailEntry[] = [];
  try {
    const buckets = await getAvailabilityBuckets(today);
    const fmt = (iso: string) =>
      new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    comingSoon = [...buckets.in2Weeks, ...buckets.in4Weeks]
      .slice(0, 10)
      .map((e) => ({
        name: e.name,
        category: e.category,
        isMicrogreen: e.source === "microgreen",
        estimate: e.estimate ?? null,
        window: e.windowStart ? `around ${fmt(e.windowStart)}` : null,
      }));
  } catch (err) {
    // Forecast is a nice-to-have teaser — never block the report on it.
    console.error("[PARTNER REPORT] forecast teaser failed:", err);
  }

  // Optional partner display name; defaults to "Phil" per the partner report spec.
  const { data: nameSetting } = await (admin as any)
    .from("farm_settings")
    .select("value")
    .eq("key", "email_partner_name")
    .maybeSingle();
  const partnerName: string = nameSetting?.value || "Phil";

  await sendPartnerReportEmail({
    toEmail,
    partnerName,
    period,
    periodLabel: label,
    totalValue: formatCurrency(totalValue),
    deliveryCount,
    topItems,
    byRestaurant,
    comingSoon,
  });

  return { sent: true, to: toEmail, period, periodLabel: label, totalValue, deliveryCount };
}
