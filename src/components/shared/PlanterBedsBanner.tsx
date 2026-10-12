import { ChevronDown, Flower2 } from "lucide-react";
import { countPlanterBedItems, type PlanterBedGroup } from "@/lib/planter-beds/group";

const BANK_GOTHIC = "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif";

interface Props {
  groups: PlanterBedGroup[];
}

/**
 * Chef-facing card at the top of the order sheet (under the greenhouse strip)
 * listing what is growing in the restaurant planter beds right now, bed by
 * bed. The point: pick these on property instead of ordering them. Collapsed
 * by default so it never pushes the order form down the phone screen; renders
 * nothing when there are no plantings.
 */
export function PlanterBedsBanner({ groups }: Props) {
  const total = countPlanterBedItems(groups);
  if (total === 0) return null;

  return (
    <details className="group bg-white rounded-2xl border border-farm-green/25 shadow-sm">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-4 min-h-[44px]">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-farm-green font-medium inline-flex items-center gap-1.5"
            style={{ fontFamily: BANK_GOTHIC }}
          >
            <Flower2 className="w-3 h-3" aria-hidden="true" /> In the Planter Beds
          </p>
          <span className="text-[10px] text-farm-muted whitespace-nowrap inline-flex items-center gap-1">
            {total} growing
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </div>
        <p className="text-[11px] text-farm-muted leading-snug">
          Pick these yourself on property — no need to order them. Tap to see what&apos;s in each bed.
        </p>
      </summary>

      <div className="px-4 pb-4 space-y-4">
        {groups.map((g) => (
          <div key={g.series || "other"}>
            <p className="text-[10px] uppercase tracking-wider text-farm-muted mb-1.5">{g.label}</p>
            <ul className="space-y-1.5">
              {g.beds.map((b) => (
                <li key={b.box} className="flex items-start gap-3 text-sm leading-snug">
                  <span className="w-10 flex-shrink-0 text-[11px] font-medium text-farm-green mt-0.5">
                    {b.box}
                  </span>
                  <span className="flex-1 min-w-0 text-farm-dark">{b.items.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
