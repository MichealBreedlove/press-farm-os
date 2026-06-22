import type {
  MicrogreenCrop,
  MicrogreenTray,
  MicrogreenBatch,
  MicrogreenHarvestStage,
} from "@/types/database";

/**
 * One crop's worth of trays that are ready to cut in the greenhouse right now.
 * Powers the chef-/bar-facing "Ready in the Greenhouse" banner on /order so the
 * CDPs harvest from our own trays instead of ordering microgreens from Meadowood.
 */
export interface ReadyHarvestCrop {
  cropId: string;
  name: string;
  variety: string | null;
  trayCount: number;
  harvestStage: MicrogreenHarvestStage;
  /** e.g. "12 LG / 24 SM" — totals across the ready trays (alternative units). */
  yieldEstimate: string | null;
}

/**
 * Sum a crop's per-tray yield map across the ready trays. yield_per_tray is a
 * set of ALTERNATIVE units ({lg:4, sm:8} = one tray gives 4 LG OR 8 SM), so we
 * scale each unit by tray count and join them — mirrors forecasting/compute.ts.
 */
function yieldEstimate(
  map: Record<string, number> | null | undefined,
  trayCount: number,
): string | null {
  if (!map) return null;
  const parts: string[] = [];
  for (const [unit, perTray] of Object.entries(map)) {
    const per = Number(perTray);
    if (!Number.isFinite(per) || per <= 0) continue;
    parts.push(`${per * trayCount} ${unit.toUpperCase()}`);
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}

/**
 * Group the trays a grower has marked ready (status 'harvesting') by crop, so
 * the chef/bar banner only shows crops a human has confirmed at baby green —
 * never an automatic day-count guess. Trays link to crops via their batch, so
 * we resolve batch_id -> crop_id first. Result is sorted by crop name.
 */
export function computeReadyToHarvest({
  crops,
  batches,
  trays,
}: {
  crops: MicrogreenCrop[];
  batches: Pick<MicrogreenBatch, "id" | "crop_id">[];
  trays: MicrogreenTray[];
}): ReadyHarvestCrop[] {
  const cropById = new Map(crops.map((c) => [c.id, c]));
  const cropIdByBatch = new Map(batches.map((b) => [b.id, b.crop_id]));

  const grouped = new Map<string, { crop: MicrogreenCrop; count: number }>();
  for (const tray of trays) {
    if (tray.status !== "harvesting") continue;
    const cropId = cropIdByBatch.get(tray.batch_id);
    if (!cropId) continue;
    const crop = cropById.get(cropId);
    if (!crop) continue;

    const entry = grouped.get(cropId) ?? { crop, count: 0 };
    entry.count += 1;
    grouped.set(cropId, entry);
  }

  return [...grouped.values()]
    .map(({ crop, count }) => ({
      cropId: crop.id,
      name: crop.name,
      variety: crop.variety,
      trayCount: count,
      harvestStage: crop.harvest_stage,
      yieldEstimate: yieldEstimate(crop.yield_per_tray, count),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
