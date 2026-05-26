import type { AvailabilityBuckets, AvailabilityEntry } from "@/lib/forecasting";
import { formatDateShort } from "@/lib/utils";

/**
 * Compact "Available now / 2 wk / 4 wk / 2 mo" horizon summary, rendered from
 * getAvailabilityBuckets(today). Server-friendly (pure presentational, plain
 * data in). Field crops and microgreens are unioned by the forecasting lib;
 * source is shown as a small dot so admin can tell them apart at a glance.
 */

interface Props {
  buckets: AvailabilityBuckets;
}

const HORIZONS: Array<{ key: keyof Omit<AvailabilityBuckets, "referenceDate">; label: string }> = [
  { key: "now", label: "Available Now" },
  { key: "in2Weeks", label: "In ~2 Weeks" },
  { key: "in4Weeks", label: "In ~4 Weeks" },
  { key: "in2Months", label: "In ~2 Months" },
];

function EntryRow({ entry }: { entry: AvailabilityEntry }) {
  const dot = entry.source === "field" ? "bg-pf-master-orange" : "bg-blue-500";
  return (
    <li className="flex items-start gap-1.5 text-xs text-farm-dark leading-snug">
      <span className={`mt-1 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="font-medium">{entry.name}</span>
        {entry.estimate && <span className="text-farm-muted"> · {entry.estimate}</span>}
      </span>
    </li>
  );
}

export function HarvestBuckets({ buckets }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {HORIZONS.map(({ key, label }) => {
        const entries = buckets[key];
        return (
          <div
            key={key}
            className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm p-3 flex flex-col"
          >
            <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold">
              {label}
            </p>
            <p className="font-display text-2xl text-farm-dark leading-none mt-1 mb-2">
              {entries.length}
            </p>
            {entries.length === 0 ? (
              <p className="text-[11px] text-farm-muted/70 italic">Nothing projected</p>
            ) : (
              <ul className="space-y-1">
                {entries.slice(0, 6).map((e, i) => (
                  <EntryRow key={i} entry={e} />
                ))}
                {entries.length > 6 && (
                  <li className="text-[11px] text-farm-muted pl-3">+{entries.length - 6} more</li>
                )}
              </ul>
            )}
          </div>
        );
      })}
      <p className="col-span-2 lg:col-span-4 text-[10px] text-farm-muted/80 leading-relaxed">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-pf-master-orange align-middle mr-1" />
        Field crops
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle ml-3 mr-1" />
        Microgreens
        {" · "}Projected from plantings &amp; microgreen batches as of {formatDateShort(buckets.referenceDate)}.
      </p>
    </div>
  );
}
