import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditorialHero } from "@/components/shared/EditorialHero";
import {
  ForecastCalendar,
  FORECAST_LEGEND,
  forecastEventKind,
} from "@/components/shared/ForecastCalendar";
import {
  getCalendarEvents,
  getFieldCropWindows,
  getMicrogreenWindows,
} from "@/lib/forecasting";
import type { ForecastCalendarEvent } from "@/lib/forecasting";
import { formatDateShort } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

/**
 * /calendar — Chef Harvest Calendar (read-only).
 *
 * Shows farm-wide projected crop availability (field crops) plus microgreen
 * sow + ready-to-harvest milestones for the visible month, with a readable
 * agenda beneath the grid (a phone grid is tight). This is production-wide
 * info — NOT restaurant-scoped — so any signed-in chef sees the same data.
 *
 * Month nav is query-param based (server recomputes events per month) to match
 * the admin calendar and avoid client-side data fetching. The forecasting
 * fetchers use the admin client server-side; only plain data crosses to the
 * client grid.
 */
export default async function ChefCalendarPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { year: yearParam, month: monthParam } = await searchParams;
  const today = new Date();
  const year = parseInt(yearParam ?? "") || today.getFullYear();
  const monthOneIndexed = parseInt(monthParam ?? "") || today.getMonth() + 1;

  const monthStart = `${year}-${String(monthOneIndexed).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthOneIndexed, 0).getDate();
  const monthEnd = `${year}-${String(monthOneIndexed).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const todayIso = today.toISOString().slice(0, 10);

  // Calendar events for the grid + windows for the readable agenda.
  const [events, fieldWindows, microgreenWindows] = await Promise.all([
    getCalendarEvents(monthStart, monthEnd),
    getFieldCropWindows(monthStart, monthEnd),
    getMicrogreenWindows(monthStart, monthEnd),
  ]);

  const eventsByDate: Record<string, ForecastCalendarEvent[]> = {};
  for (const e of events) (eventsByDate[e.date] ??= []).push(e);

  // Month nav
  const prevDate = new Date(year, monthOneIndexed - 2, 1);
  const nextDate = new Date(year, monthOneIndexed, 1);
  const prevHref = `/calendar?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`;
  const nextHref = `/calendar?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`;
  const monthLabel = new Date(year, monthOneIndexed - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Agenda: field crops sorted by when their window opens, then microgreens by
  // ready date. Both are kept separate so chefs can scan "what's coming" vs
  // "what's been seeded for me".
  const fieldAgenda = [...fieldWindows].sort((a, b) =>
    a.windowStart.localeCompare(b.windowStart) || a.name.localeCompare(b.name),
  );
  const mgAgenda = [...microgreenWindows].sort((a, b) =>
    a.readyOn.localeCompare(b.readyOn) || a.name.localeCompare(b.name),
  );

  const hasAny = fieldAgenda.length > 0 || mgAgenda.length > 0;

  return (
    <main className="pb-24 bg-farm-cream min-h-screen">
      <EditorialHero
        eyebrow="From the Field"
        title="Harvest Calendar"
        subtitle="What's coming up — field crops, plus microgreens we've seeded and when they'll be ready."
        flower="anise-hyssop"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        <ForecastCalendar
          year={year}
          month={monthOneIndexed - 1}
          monthLabel={monthLabel}
          eventsByDate={eventsByDate}
          legend={FORECAST_LEGEND}
          eventKind={forecastEventKind}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref="/calendar"
          todayIso={todayIso}
          cellHref={(iso) => `/order?date=${iso}`}
        />

        {/* Readable agenda — easier than the grid on a phone */}
        <section className="space-y-5">
          {!hasAny && (
            <p className="text-sm text-farm-muted text-center py-6">
              Nothing projected for {monthLabel}. Check the next month, or your regular order list.
            </p>
          )}

          {fieldAgenda.length > 0 && (
            <div>
              <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-3">
                Field Crops
              </h3>
              <ul className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm divide-y divide-farm-dark/5 overflow-hidden">
                {fieldAgenda.map((w) => (
                  <li key={w.plantingId} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-farm-dark text-sm leading-snug">{w.name}</p>
                      {w.category && (
                        <p className="text-[11px] text-farm-muted uppercase tracking-wider mt-0.5">
                          {w.category}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-farm-dark">
                        {formatDateShort(w.windowStart)}
                        <span className="text-farm-muted"> – {formatDateShort(w.windowEnd)}</span>
                      </p>
                      {w.quantity != null && (
                        <p className="text-[11px] text-farm-muted mt-0.5">
                          ~{w.quantity}
                          {w.unit ? ` ${w.unit}` : ""}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mgAgenda.length > 0 && (
            <div>
              <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-3">
                Microgreens
              </h3>
              <ul className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm divide-y divide-farm-dark/5 overflow-hidden">
                {mgAgenda.map((w) => (
                  <li key={w.batchId} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-farm-dark text-sm leading-snug">{w.name}</p>
                      <p className="text-[11px] text-farm-muted mt-0.5">
                        Seeded {formatDateShort(w.seededOn)} · ready {formatDateShort(w.readyOn)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-farm-dark">
                        {formatDateShort(w.windowOpen)}
                        <span className="text-farm-muted"> – {formatDateShort(w.windowClose)}</span>
                      </p>
                      {w.estimate && (
                        <p className="text-[11px] text-farm-muted mt-0.5">{w.estimate}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
