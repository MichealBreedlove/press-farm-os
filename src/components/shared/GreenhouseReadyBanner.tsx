import { Sprout } from "lucide-react";
import {
  HARVEST_STAGE_LABELS,
  HARVEST_STAGE_CHIP_CLASS,
} from "@/lib/microgreens/constants";
import type { ReadyHarvestCrop } from "@/lib/microgreens/readyToHarvest";

const BANK_GOTHIC = "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif";

interface Props {
  crops: ReadyHarvestCrop[];
}

/**
 * Compact, chef-/bar-facing strip at the top of /order (just under the weather)
 * listing the microgreens that are ready to cut from our greenhouse trays right
 * now. The point: CDPs harvest these in-house instead of ordering them from
 * Meadowood. Renders nothing when no trays are ready, so it never eats space.
 */
export function GreenhouseReadyBanner({ crops }: Props) {
  if (crops.length === 0) return null;

  const totalTrays = crops.reduce((sum, c) => sum + c.trayCount, 0);

  return (
    <div className="bg-white rounded-2xl border border-farm-green/25 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-farm-green font-medium inline-flex items-center gap-1.5"
          style={{ fontFamily: BANK_GOTHIC }}
        >
          <Sprout className="w-3 h-3" aria-hidden="true" /> Ready in the Greenhouse
        </p>
        <span className="text-[10px] text-farm-muted whitespace-nowrap">
          {totalTrays} {totalTrays === 1 ? "tray" : "trays"}
        </span>
      </div>
      <p className="text-[11px] text-farm-muted leading-snug mb-3">
        Cut these from our trays — no need to order from Meadowood.
      </p>
      <ul className="space-y-2">
        {crops.map((c) => (
          <li key={c.cropId} className="flex items-start gap-2 text-sm leading-snug">
            <span
              className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-farm-green"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-farm-dark flex items-center flex-wrap gap-x-1.5 gap-y-1">
                <span className="font-medium">{c.name}</span>
                {c.variety && <span className="text-farm-muted">· {c.variety}</span>}
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded ${HARVEST_STAGE_CHIP_CLASS[c.harvestStage]}`}
                >
                  {HARVEST_STAGE_LABELS[c.harvestStage]}
                </span>
              </p>
              {c.yieldEstimate && (
                <p className="text-[11px] text-farm-muted">~{c.yieldEstimate}</p>
              )}
            </div>
            <span className="text-[11px] text-farm-muted whitespace-nowrap mt-0.5">
              {c.trayCount} {c.trayCount === 1 ? "tray" : "trays"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
