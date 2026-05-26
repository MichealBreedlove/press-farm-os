"use client";

import type { ForecastCalendarEvent } from "@/lib/forecasting/types";

interface Props {
  weekStart: string;
  events: ForecastCalendarEvent[];
}

function formatWeekHeading(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function eventTag(ev: ForecastCalendarEvent): string {
  switch (ev.type) {
    case "harvest-start": return "opens";
    case "harvest-end":   return "closes";
    case "sow":           return "sown";
    case "harvest-open":  return "harvest opens";
    case "harvest-ideal": return "harvest peak";
    case "harvest-close": return "harvest closes";
    default:              return "";
  }
}

/**
 * Concrete-zone drawer content: events bucketed by source (field vs
 * microgreen) for the selected ISO week. Pulls verb from event.type so
 * each row reads naturally ("opens Jun 9" vs "harvest peak Jun 11").
 */
export function ConcreteWeekDetail({ weekStart, events }: Props) {
  const field = events.filter((e) => e.source === "field");
  const micro = events.filter((e) => e.source === "microgreen");

  if (field.length === 0 && micro.length === 0) {
    return (
      <p className="text-sm text-farm-muted py-6 text-center">
        Nothing harvesting this week.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-[11px] tracking-[0.18em] uppercase text-pf-master-gold">
        Harvesting week of {formatWeekHeading(weekStart)}
      </h3>

      {field.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-farm-dark mb-2">Field crops</h4>
          <ul className="divide-y divide-pf-master-gold/15">
            {field.map((ev) => (
              <li key={ev.refId + "-" + ev.type + "-" + ev.date} className="py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-farm-dark">{ev.name}</span>
                <span className="text-xs text-farm-muted whitespace-nowrap">
                  {eventTag(ev)} {formatEventDate(ev.date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {micro.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-pf-master-gold mb-2">Microgreens</h4>
          <ul className="divide-y divide-pf-master-gold/15">
            {micro.map((ev) => (
              <li key={ev.refId + "-" + ev.type + "-" + ev.date} className="py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-farm-dark">{ev.name}</span>
                <span className="text-xs text-farm-muted whitespace-nowrap">
                  {eventTag(ev)} {formatEventDate(ev.date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
