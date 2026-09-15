import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayPacific } from "@/lib/utils";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { HarvestBuckets } from "@/components/admin/HarvestBuckets";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import { getCalendarMonth } from "@/lib/calendar/fetch";
import { monthTotals } from "@/lib/calendar";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ year?: string; month?: string; date?: string; view?: string }>;
}

/**
 * /admin/calendar — the farm's one calendar.
 *
 * Server renders the requested month (SSR, no flash) and hands it to
 * CalendarClient, which pages months client-side via GET /api/calendar,
 * layers orders / deliveries / tasks / harvest forecast / event requests /
 * notes / labor on one grid, and opens a per-day panel with quick actions.
 *
 * The old `?view=forecast` toggle is folded into the "Harvest" layer; the
 * param is still accepted so bookmarks keep working.
 */
export default async function AdminCalendarPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { year: yearParam, month: monthParam, date: dateParam } = await searchParams;
  const todayStr = todayPacific();
  const [todayYear, todayMonth] = todayStr.split("-").map(Number);

  // ?date= wins for the month so a deep link opens on the right page.
  const dateOk = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const year = (dateOk && Number(dateOk.slice(0, 4))) || parseInt(yearParam ?? "") || todayYear;
  const monthRaw = (dateOk && Number(dateOk.slice(5, 7))) || parseInt(monthParam ?? "") || todayMonth;
  const month = Math.min(12, Math.max(1, monthRaw));

  const [initialMonth, buckets] = await Promise.all([
    getCalendarMonth(year, month),
    getAvailabilityBuckets(todayStr),
  ]);
  const totals = monthTotals(initialMonth);

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Calendar</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Farm Schedule"
        title="Calendar"
        subtitle={`${totals.orders} order${totals.orders === 1 ? "" : "s"} · ${totals.deliveries} deliver${totals.deliveries === 1 ? "y" : "ies"}${totals.deliveryTotal > 0 ? ` · $${totals.deliveryTotal.toFixed(0)}` : ""}${totals.openTasks > 0 ? ` · ${totals.openTasks} open task${totals.openTasks === 1 ? "" : "s"}` : ""}`}
        flower="anise-hyssop"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-6 max-w-5xl mx-auto space-y-8">
        <CalendarClient initialMonth={initialMonth} todayIso={todayStr} initialDate={dateOk} />

        {/* Horizon summary — projected harvest availability, below the
            calendar so the grid is the first thing on a phone. */}
        <section>
          <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-3">
            Projected Harvest Availability
          </h3>
          <HarvestBuckets buckets={buckets} />
        </section>
      </div>
    </main>
  );
}
