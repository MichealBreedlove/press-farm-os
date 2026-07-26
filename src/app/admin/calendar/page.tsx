import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayPacific } from "@/lib/utils";
import { EditorialHero } from "@/components/shared/EditorialHero";
import {
  ForecastCalendar,
  FORECAST_LEGEND,
  forecastEventKind,
} from "@/components/shared/ForecastCalendar";
import { HarvestBuckets } from "@/components/admin/HarvestBuckets";
import { getCalendarEvents, getAvailabilityBuckets } from "@/lib/forecasting";
import type { ForecastCalendarEvent } from "@/lib/forecasting";
import { CalendarGrid } from "./CalendarGrid";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ year?: string; month?: string; view?: string }>;
}

/**
 * /admin/calendar — Unified activity calendar.
 *
 * Single monthly grid showing every delivery date with badges for:
 *   - Orders submitted (count)
 *   - Deliveries logged (count)
 *   - Receiver email sent (✓ when audit log has any entry)
 *   - Availability published (leaf icon when availability_items exist)
 *
 * Each cell is a Link to /admin/orders/[date] so admin can drill in.
 */
export default async function AdminCalendarPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { year: yearParam, month: monthParam, view: viewParam } = await searchParams;
  const view = viewParam === "forecast" ? "forecast" : "activity";
  const todayStr = todayPacific();
  const [todayYear, todayMonth] = todayStr.split("-").map(Number);
  const year = parseInt(yearParam ?? "") || todayYear;
  // Stored 1-indexed in URL (1=Jan, 12=Dec) so it reads naturally; converted
  // to 0-indexed for Date math.
  const monthOneIndexed = parseInt(monthParam ?? "") || todayMonth;

  const monthStart = `${year}-${String(monthOneIndexed).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthOneIndexed, 0).getDate();
  const monthEnd = `${year}-${String(monthOneIndexed).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const admin = createAdminClient();

  // Pull every signal in parallel — each is a small list scoped to the month
  const [
    { data: deliveryDates },
    { data: orders },
    { data: deliveries },
    { data: availabilityRows },
    { data: notifyRows },
  ] = await Promise.all([
    (admin as any).from("delivery_dates")
      .select("date, day_of_week, ordering_open")
      .gte("date", monthStart).lte("date", monthEnd),
    (admin as any).from("orders")
      .select("id, delivery_date, status")
      .gte("delivery_date", monthStart).lte("delivery_date", monthEnd),
    (admin as any).from("deliveries")
      .select("id, delivery_date, status, total_value")
      .gte("delivery_date", monthStart).lte("delivery_date", monthEnd),
    (admin as any).from("availability_items")
      .select("delivery_date").gte("delivery_date", monthStart).lte("delivery_date", monthEnd),
    (admin as any).from("receiver_notify_log")
      .select("delivery_date, sent_at")
      .gte("delivery_date", monthStart).lte("delivery_date", monthEnd),
  ]);

  // Aggregate per-date signals into a single map for the client
  type DayActivity = {
    date: string;
    isDeliveryDate: boolean;
    orderingOpen: boolean;
    orderCount: number;
    deliveryCount: number;
    deliveryTotal: number;
    availabilityPublished: boolean;
    notified: boolean;
    isToday: boolean;
  };

  const map = new Map<string, DayActivity>();

  function ensure(date: string): DayActivity {
    let day = map.get(date);
    if (!day) {
      day = {
        date,
        isDeliveryDate: false,
        orderingOpen: false,
        orderCount: 0,
        deliveryCount: 0,
        deliveryTotal: 0,
        availabilityPublished: false,
        notified: false,
        isToday: date === todayStr,
      };
      map.set(date, day);
    }
    return day;
  }

  for (const d of (deliveryDates ?? []) as any[]) {
    const day = ensure(d.date);
    day.isDeliveryDate = true;
    day.orderingOpen = Boolean(d.ordering_open);
  }
  for (const o of (orders ?? []) as any[]) ensure(o.delivery_date).orderCount++;
  for (const d of (deliveries ?? []) as any[]) {
    const day = ensure(d.delivery_date);
    day.deliveryCount++;
    day.deliveryTotal += Number(d.total_value ?? 0);
  }
  for (const a of (availabilityRows ?? []) as any[]) {
    ensure(a.delivery_date).availabilityPublished = true;
  }
  for (const n of (notifyRows ?? []) as any[]) ensure(n.delivery_date).notified = true;

  const activity = Array.from(map.values());

  // Prev / next month navigation (preserve the active view)
  const prevDate = new Date(year, monthOneIndexed - 2, 1);
  const nextDate = new Date(year, monthOneIndexed, 1);
  const viewQs = view === "forecast" ? "&view=forecast" : "";
  const prevHref = `/admin/calendar?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}${viewQs}`;
  const nextHref = `/admin/calendar?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}${viewQs}`;
  const todayHref = `/admin/calendar${view === "forecast" ? "?view=forecast" : ""}`;
  const monthLabel = new Date(year, monthOneIndexed - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // ── Harvest forecast layer ───────────────────────────────────────────────
  // Always load the "available now / 2wk / 4wk / 2mo" buckets for the summary.
  // Only load the month's calendar events when the forecast view is active.
  const todayIso = todayStr;
  const [buckets, forecastEvents] = await Promise.all([
    getAvailabilityBuckets(todayIso),
    view === "forecast"
      ? getCalendarEvents(monthStart, monthEnd)
      : Promise.resolve([] as ForecastCalendarEvent[]),
  ]);

  const forecastByDate: Record<string, ForecastCalendarEvent[]> = {};
  for (const e of forecastEvents) {
    (forecastByDate[e.date] ??= []).push(e);
  }

  // Month-level stats for the eyebrow
  const monthOrderCount = activity.reduce((s, d) => s + d.orderCount, 0);
  const monthDeliveryCount = activity.reduce((s, d) => s + d.deliveryCount, 0);
  const monthDeliveryTotal = activity.reduce((s, d) => s + d.deliveryTotal, 0);

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Calendar</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Farm Schedule"
        title="Calendar"
        subtitle={`${monthOrderCount} order${monthOrderCount === 1 ? "" : "s"} · ${monthDeliveryCount} deliver${monthDeliveryCount === 1 ? "y" : "ies"}${monthDeliveryTotal > 0 ? ` · $${monthDeliveryTotal.toFixed(0)}` : ""}`}
        flower="anise-hyssop"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        {/* Horizon summary — projected harvest availability */}
        <section>
          <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-3">
            Projected Harvest Availability
          </h3>
          <HarvestBuckets buckets={buckets} />
        </section>

        {/* View toggle: existing activity calendar vs harvest forecast */}
        <div className="inline-flex rounded-full border border-farm-dark/10 bg-white p-1 text-xs font-medium">
          <Link
            href={`/admin/calendar?year=${year}&month=${monthOneIndexed}`}
            className={`px-4 py-2 rounded-full min-h-[40px] flex items-center transition-colors ${
              view === "activity" ? "bg-farm-green text-white" : "text-farm-muted hover:text-farm-dark"
            }`}
          >
            Activity
          </Link>
          <Link
            href={`/admin/calendar?year=${year}&month=${monthOneIndexed}&view=forecast`}
            className={`px-4 py-2 rounded-full min-h-[40px] flex items-center transition-colors ${
              view === "forecast" ? "bg-farm-green text-white" : "text-farm-muted hover:text-farm-dark"
            }`}
          >
            Harvest forecast
          </Link>
        </div>

        {view === "activity" ? (
          <CalendarGrid
            year={year}
            month={monthOneIndexed - 1}
            monthLabel={monthLabel}
            activity={activity}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        ) : (
          <ForecastCalendar
            year={year}
            month={monthOneIndexed - 1}
            monthLabel={monthLabel}
            eventsByDate={forecastByDate}
            legend={FORECAST_LEGEND}
            eventKind={forecastEventKind}
            prevHref={prevHref}
            nextHref={nextHref}
            todayHref={todayHref}
            todayIso={todayIso}
          />
        )}
      </div>
    </main>
  );
}
