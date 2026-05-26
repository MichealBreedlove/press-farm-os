"use client";

import { CATEGORY_LABELS } from "@/lib/constants";

interface Props {
  month: number;
  grouped: Record<string, Array<{ id: string; name: string; category: string | null }>>;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function categoryLabel(key: string): string {
  const label = (CATEGORY_LABELS as Record<string, string | undefined>)[key];
  if (label) return label;
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Seasonal-zone drawer content: category-grouped list of typical items
 * with no window dates — just a "Typical" badge per row.
 */
export function SeasonalMonthDetail({ month, grouped }: Props) {
  const sections = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  if (sections.length === 0) {
    return (
      <p className="text-sm text-farm-muted py-6 text-center">
        No items typical for {MONTH_NAMES[month - 1]} yet — admin still
        filling in seasonality.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-[11px] tracking-[0.18em] uppercase text-pf-master-gold">
        Typically available in {MONTH_NAMES[month - 1]}
      </h3>

      {sections.map(([catKey, items]) => (
        <section key={catKey}>
          <h4 className="text-sm font-semibold text-farm-dark mb-2">
            {categoryLabel(catKey)}
          </h4>
          <ul className="divide-y divide-pf-master-gold/15">
            {items.map((it) => (
              <li key={it.id} className="py-2 flex items-center gap-2">
                <span className="text-sm text-farm-dark flex-1">{it.name}</span>
                <span className="text-[9px] tracking-[0.14em] uppercase text-pf-master-gold border border-pf-master-gold/50 rounded-full px-2 py-0.5">
                  Typical
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
