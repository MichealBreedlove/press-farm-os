import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import { sendPartnerReportEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";
import type { PartnerReportLine } from "@/emails/partner-report";
import type { ForecastEmailEntry } from "@/emails/availability-forecast";

type Period = "monthly" | "quarterly";
interface PeriodRange {
  start: string;
  end: string;
  label: string;
}

/**
 * Partner / Chef Phil report (monthly + quarterly).
 *
 *   GET  — Vercel Cron. The `type` query param selects what to send:
 *            • `type=monthly` (1st of each month) → previous calendar month.
 *            • `type=q1|q2|q3|q4` (last day of Mar/Jun/Sep/Dec) → that exact
 *              calendar quarter of the current year. Quarters are fixed:
 *              Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec.
 *          Requires `Authorization: Bearer ${CRON_SECRET}` (fail-closed in
 *          prod, unsigned OK in local dev).
 *   POST — Manual admin trigger. Body:
 *            • { period: 'quarterly', year, quarter }  (year/quarter optional —
 *              default to the most recent COMPLETED quarter)
 *            • { period: 'monthly', year, month }      (optional — default to
 *              the previous month)
 *
 * Recipient is read from farm_settings.email_partner_report. If unset, the send
 * is skipped and a clear message is returned (graceful no-op).
 *
 * The period range is ALWAYS an exact calendar boundary, so a quarterly report
 * only ever contains that quarter's three months — never spillover.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Exact calendar quarter. quarter is 1-based (1=Q1 Jan–Mar … 4=Q4 Oct–Dec). */
function quarterRange(year: number, quarter: number): PeriodRange {
  const startMonth = (quarter - 1) * 3; // 0-based
  const endMonth = startMonth + 2;
  const start = `${year}-${pad(startMonth + 1)}-01`;
  const lastDay = new Date(year, endMonth + 1, 0).getDate();
  const end = `${year}-${pad(endMonth + 1)}-${pad(lastDay)}`;
  return { start, end, label: `Q${quarter} ${year}` };
}

/** Single calendar month. month is 1-based. */
function monthRange(year: number, month: number): PeriodRange {
  const start = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(lastDay)}`;
  const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return { start, end, label };
}

function previousMonth(now: Date): { year: number; month: number } {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** The most recent fully-completed quarter relative to `now`. */
function mostRecentCompletedQuarter(now: Date): { year: number; quarter: number } {
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1; // 1–4
  let quarter = currentQuarter - 1;
  let year = now.getFullYear();
  if (quarter < 1) {
    quarter = 4;
    year -= 1;
  }
  return { year, quarter };
}

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

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "monthly").toLowerCase();
  const now = new Date();

  let period: Period;
  let range: PeriodRange;
  const quarterMatch = /^q([1-4])$/.exec(type);
  if (quarterMatch) {
    // Fired on the last day of the quarter — report that quarter of this year.
    period = "quarterly";
    range = quarterRange(now.getFullYear(), parseInt(quarterMatch[1], 10));
  } else {
    period = "monthly";
    const { year, month } = previousMonth(now);
    range = monthRange(year, month);
  }

  const result = await buildAndSend(period, range);
  return NextResponse.json({ success: true, period, periodLabel: range.label, ...(result as object) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({} as any));
  const period: Period = body?.period === "quarterly" ? "quarterly" : "monthly";
  const now = new Date();

  let range: PeriodRange;
  if (period === "quarterly") {
    let year = Number(body?.year);
    let quarter = Number(body?.quarter);
    if (!Number.isInteger(year) || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      ({ year, quarter } = mostRecentCompletedQuarter(now));
    }
    range = quarterRange(year, quarter);
  } else {
    let year = Number(body?.year);
    let month = Number(body?.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      ({ year, month } = previousMonth(now));
    }
    range = monthRange(year, month);
  }

  const result = await buildAndSend(period, range);
  return NextResponse.json({ success: true, period, periodLabel: range.label, ...(result as object) });
}

async function buildAndSend(period: Period, { start, end, label }: PeriodRange) {
  const admin = createAdminClient();

  // Partner recipient from farm_settings — graceful skip when unset.
  const { data: setting } = await admin
    .from("farm_settings")
    .select("value")
    .eq("key", "email_partner_report")
    .maybeSingle();

  const toEmail: string | null = setting?.value || null;

  if (!toEmail) {
    return {
      skipped: true,
      message: "No partner report email configured. Set it in Settings → Email Settings (Partner / Chef Phil Report).",
      period,
      periodLabel: label,
    };
  }

  // Deliveries in the period (value + restaurant). Strictly bounded to the
  // period's calendar start/end, so a quarter only ever holds its 3 months.
  const { data: deliveries } = await admin
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
    const { data: items } = await admin
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
  const { data: nameSetting } = await admin
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
