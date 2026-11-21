"use client";

import { PLACE_LABELS, TASK_PLACES, type TaskLocation } from "@/lib/tasks/location";

/**
 * "Where" on the task forms: a place (Farm / Greenhouse / Press /
 * Under-Study), and for the farm a quadrant and rows. With `inheritLabel`,
 * a later step can stay on "Same as step 1" (value null).
 */
export function LocationPicker({
  value,
  onChange,
  inheritLabel,
  label = "Where",
}: {
  value: TaskLocation | null;
  onChange: (next: TaskLocation | null) => void;
  inheritLabel?: string;
  label?: string;
}) {
  const loc: TaskLocation = value ?? { location_place: null, location_quadrant: null, location_rows: null };
  const set = (patch: Partial<TaskLocation>) => onChange({ ...loc, ...patch });
  const chip = (active: boolean) =>
    `min-h-[44px] px-3 rounded-md border text-sm font-medium transition-colors ${
      active ? "bg-farm-green text-white border-farm-green" : "bg-white text-farm-dark border-pf-master-gold/30 hover:bg-farm-cream"
    }`;
  const isFarm = loc.location_place === "farm";

  return (
    <div>
      <span className="block text-[10px] tracking-[0.18em] uppercase text-pf-gold-700 font-medium mb-1">
        {label} <span className="normal-case tracking-normal text-farm-muted">· optional</span>
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {inheritLabel && (
          <button type="button" onClick={() => onChange(null)} aria-pressed={value === null} className={chip(value === null)}>
            {inheritLabel}
          </button>
        )}
        {TASK_PLACES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value !== null && loc.location_place === p}
            className={chip(value !== null && loc.location_place === p)}
            onClick={() =>
              loc.location_place === p && value !== null
                ? set({ location_place: null, location_quadrant: null, location_rows: null })
                : set(
                    p === "farm"
                      ? { location_place: p }
                      : { location_place: p, location_quadrant: null, location_rows: null },
                  )
            }
          >
            {PLACE_LABELS.en[p]}
          </button>
        ))}
      </div>

      {value !== null && isFarm && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quadrant">
            <span className="text-sm text-farm-dark w-20">Quadrant</span>
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={loc.location_quadrant === q}
                onClick={() => set({ location_quadrant: loc.location_quadrant === q ? null : q })}
                className={`${chip(loc.location_quadrant === q)} min-w-[44px]`}
              >
                {q}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-sm text-farm-dark w-20">Rows</span>
            <input
              type="text"
              inputMode="text"
              value={loc.location_rows ?? ""}
              onChange={(e) => set({ location_rows: e.target.value || null })}
              placeholder="e.g. 5-6"
              maxLength={40}
              className="flex-1 min-w-0 text-base px-3 py-2 border border-pf-master-gold/30 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
            />
          </label>
        </div>
      )}
    </div>
  );
}
