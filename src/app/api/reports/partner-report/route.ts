import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import { sendPartnerReportEmail } from "@/lib/email";
import { formatCurrency, formatCurrencyWhole, todayPacific } from "@/lib/utils";
import { fetchAllRows } from "@/lib/fetch-all";
import { getProductionValue } from "@/lib/production-value/server";
import { yearRange, priorYearSpan, pctChange, buildMonthBars } from "@/lib/partner-report";
import { ADMIN_EMAIL, CATEGORY_LABELS } from "@/lib/constants";
import type { PartnerReportLine, PartnerReportAnnual, PartnerReportPeriod, PartnerSelfHarvest } from "@/emails/partner-report";
import type { ForecastEmailEntry } from "@/emails/availability-forecast";
import type { ItemCategory } from "@/types";

type Period = PartnerReportPeriod;
interface PeriodRange {
  start: string;
  end: string;
  label: string;
}

/**
 * Partner / Chef Phil report (monthly + quarterly + annual).
 *
 *   GET  — Vercel Cron. The `type` query param selects what to send:
 *            • `type=monthly` (1st of each month) → previous calendar month.
 *            • `type=q1|q2|q3|q4` (last day of Mar/Jun/Sep/Dec) → that exact
 *              calendar quarter of the current year. Quarters are fixed:
 *              Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec.
 *          Requires `Authorization: Bearer ${CRON_SECRET}` (fail-closed in
 *          prod, unsigned OK in local dev).
 *            • `type=annual` (Jan 2) → the previous calendar year: adds
 *              year-over-year, month-by-month, categories and self-harvest.
 *   POST — Manual admin trigger. Body:
 *            • { period: 'quarterly', year, quarter }  (year/quarter optional —
 *              default to the most recent COMPLETED quarter)
 *            • { period: 'monthly', year, month }      (optional — default to
 *              the previous month)
 *            • { period: 'annual', year }              (optional — default to
 *              the previous year; the current year gives a year-to-date report)
 *            • any of the above + `preview: true` → sends ONLY to the admin
 *              address (farm_settings.email_admin), subject prefixed [PREVIEW].
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
  if (type === "annual") {
    period = "annual";
    range = yearRange(now.getFullYear() - 1, todayPacific());
  } else if (quarterMatch) {
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
  const period: Period =
    body?.period === "quarterly" ? "quarterly" : body?.period === "annual" ? "annual" : "monthly";
  const preview = body?.preview === true;
  const now = new Date();

  let range: PeriodRange;
  if (period === "annual") {
    let year = Number(body?.year);
    if (!Number.isInteger(year) || year < 2000 || year > now.getFullYear()) year = now.getFullYear() - 1;
    range = yearRange(year, todayPacific());
  } else if (period === "quarterly") {
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

  const result = await buildAndSend(period, range, { preview });
  return NextResponse.json({ success: true, period, periodLabel: range.label, preview, ...(result as object) });
}

async function buildAndSend(
  period: Period,
  { start, end, label }: PeriodRange,
  { preview = false }: { preview?: boolean } = {},
) {
  const admin = createAdminClient();

  // Partner recipient from farm_settings — graceful skip when unset. A preview
  // goes only to the admin address, never to the partner.
  const { data: setting } = await admin
    .from("farm_settings")
    .select("value")
    .eq("key", preview ? "email_admin" : "email_partner_report")
    .maybeSingle();

  const toEmail: string | null = setting?.value || (preview ? ADMIN_EMAIL : null);

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
  // Paginated: a full year runs past Supabase's silent 1,000-row cap.
  const { data: deliveryRows } = await fetchAllRows<any>((from, to) =>
    admin
      .from("deliveries")
      .select("id, delivery_date, total_value, restaurants(name)")
      .gte("delivery_date", start)
      .lte("delivery_date", end)
      .order("id")
      .range(from, to),
  );

  const totalValue = deliveryRows.reduce((s: number, d: any) => s + Number(d.total_value ?? 0), 0);
  const deliveryCount = deliveryRows.length;

  // By-restaurant breakdown.
  const byRestaurantMap: Record<string, number> = {};
  for (const d of deliveryRows) {
    const name = (d.restaurants as any)?.name ?? "Unknown";
    byRestaurantMap[name] = (byRestaurantMap[name] ?? 0) + Number(d.total_value ?? 0);
  }
  const byRestaurant: PartnerReportLine[] = Object.entries(byRestaurantMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: formatCurrency(value) }));

  // Line items over the period, filtered through the parent delivery's date
  // (an `.in(ids)` list of a year's deliveries would blow the URL length).
  const { data: itemRows } = await fetchAllRows<any>((from, to) =>
    admin
      .from("delivery_items")
      .select("id, quantity, unit, line_total, items(name, category), deliveries!inner(delivery_date)")
      .gte("deliveries.delivery_date", start)
      .lte("deliveries.delivery_date", end)
      .order("id")
      .range(from, to),
  );

  // Top crops by total delivered value over the period.
  const itemMap: Record<string, { value: number; qty: number; unit: string | null }> = {};
  const categoryMap: Record<string, { value: number; items: Set<string> }> = {};
  for (const it of itemRows) {
    const name = (it.items as any)?.name ?? "Item";
    const category = (it.items as any)?.category ?? "other";
    const lineValue = Number(it.line_total ?? 0);
    if (!itemMap[name]) itemMap[name] = { value: 0, qty: 0, unit: it.unit ?? null };
    itemMap[name].value += lineValue;
    itemMap[name].qty += Number(it.quantity ?? 0);
    if (!categoryMap[category]) categoryMap[category] = { value: 0, items: new Set() };
    categoryMap[category].value += lineValue;
    categoryMap[category].items.add(name);
  }
  const topItems: PartnerReportLine[] = [];
  for (const [name, agg] of Object.entries(itemMap)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, period === "annual" ? 10 : 8)) {
    topItems.push({
      label: name,
      value: formatCurrency(agg.value),
      sub: `${agg.qty % 1 === 0 ? agg.qty : agg.qty.toFixed(1)}${agg.unit ? ` ${agg.unit.toUpperCase()}` : ""}`,
    });
  }

  // Self-harvest (planter boxes + microgreens) within the period, by month.
  // It's part of what the farm produced, so it's folded into the headline
  // total for every period type. Period ranges are whole calendar months
  // (a partial year is capped at `end` by getProductionValue itself).
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  const inPeriod = (k: string) => k >= startMonth && k <= endMonth;
  let selfHarvest: PartnerSelfHarvest | null = null;
  const selfHarvestByMonth: Record<string, number> = {};
  try {
    const pv = await getProductionValue(end);
    const sumIn = (m: Record<string, number>) =>
      Object.entries(m).reduce((s, [k, v]) => (inPeriod(k) ? s + v : s), 0);
    const boxes = sumIn(pv.boxByMonth);
    const micro = sumIn(pv.microByMonth);
    for (const src of [pv.boxByMonth, pv.microByMonth]) {
      for (const [k, v] of Object.entries(src)) {
        if (inPeriod(k)) selfHarvestByMonth[k] = (selfHarvestByMonth[k] ?? 0) + v;
      }
    }
    if (boxes + micro > 0) {
      selfHarvest = {
        boxes: formatCurrencyWhole(boxes),
        microgreens: formatCurrencyWhole(micro),
        total: formatCurrencyWhole(boxes + micro),
        grandTotal: formatCurrencyWhole(totalValue + boxes + micro),
      };
    }
  } catch (err) {
    // Self-harvest is a nice-to-have — never block the report on it.
    console.error("[PARTNER REPORT] production value failed:", err);
  }

  let annual: PartnerReportAnnual | null = null;
  if (period === "annual") {
    const year = Number(start.slice(0, 4));
    const partialThrough = end < `${year}-12-31` ? end : null;

    // Year-over-year: the same span one year earlier (a year-to-date report
    // compares against the same stretch last year, not last year's full total).
    const prior = priorYearSpan({ start, end });
    const { data: priorRows } = await fetchAllRows<any>((from, to) =>
      admin
        .from("deliveries")
        .select("id, total_value")
        .gte("delivery_date", prior.start)
        .lte("delivery_date", prior.end)
        .order("id")
        .range(from, to),
    );
    const priorTotal = priorRows.reduce((s: number, d: any) => s + Number(d.total_value ?? 0), 0);
    const change = pctChange(totalValue, priorTotal);
    // Deliveries only: planter-box tracking started in 2026, so comparing
    // totals against a year with no self-harvest data would overstate growth.
    const comparison =
      change === null
        ? null
        : `Deliveries ${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs. ${partialThrough ? `the same stretch of ${year - 1}` : year - 1} (${formatCurrencyWhole(priorTotal)})`;

    // Month bars show total production: deliveries + self-harvest.
    const byMonth: Record<string, number> = { ...selfHarvestByMonth };
    for (const d of deliveryRows) {
      const key = String(d.delivery_date).slice(0, 7);
      byMonth[key] = (byMonth[key] ?? 0) + Number(d.total_value ?? 0);
    }

    const byCategory: PartnerReportLine[] = Object.entries(categoryMap)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([cat, agg]) => ({
        label: CATEGORY_LABELS[cat as ItemCategory] ?? cat,
        value: formatCurrencyWhole(agg.value),
        sub: `${agg.items.size} ${agg.items.size === 1 ? "item" : "items"}`,
      }));

    annual = {
      comparison,
      itemCount: Object.keys(itemMap).length,
      months: buildMonthBars(year, byMonth, partialThrough),
      byCategory,
      throughLabel: partialThrough
        ? new Date(`${partialThrough}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : null,
    };
  }

  // Forward-looking teaser — next 2wk + 4wk windows from the availability forecast.
  const today = todayPacific();
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
    selfHarvest,
    annual,
    subjectPrefix: preview ? "[PREVIEW] " : undefined,
  });

  return { sent: true, to: toEmail, period, periodLabel: label, totalValue, deliveryCount };
}
