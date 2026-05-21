import type {
  MicrogreenCrop, MicrogreenDemand, MicrogreenBatch, MicrogreenTray,
} from "@/types/database";
import type {
  SowPlan, SowTask, AdvanceTask, HarvestTask, DemandLine, YieldUnit,
} from "./types";
import { isReadyToAdvance, isReadyToHarvest, nextStatus } from "./stages";
import { PLAN_HORIZON_DAYS } from "./constants";

export type SowPlanInput = {
  crops: MicrogreenCrop[];
  demand: MicrogreenDemand[];
  batches: MicrogreenBatch[];
  trays: MicrogreenTray[];
  deliveryDates: string[]; // future ISO dates within horizon
  now: Date;
};

const MS_PER_DAY = 24 * 3600 * 1000;
const VALID_UNITS: ReadonlySet<YieldUnit> = new Set(["lg", "sm", "ea"]);

function pad(n: number) { return n.toString().padStart(2, "0"); }

function isoDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateUtc(d);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * Resolve effective demand for a crop on a given delivery date.
 * Sums quantity per unit across all matching demand rows (restaurants, etc).
 */
function effectiveDemandFor(
  crop: MicrogreenCrop,
  deliveryDate: string,
  demand: MicrogreenDemand[],
): DemandLine[] {
  const dow = new Date(deliveryDate + "T00:00:00Z").getUTCDay();
  const matching = demand.filter((d) => {
    if (d.crop_id !== crop.id) return false;
    if (d.day_of_week !== dow) return false;
    if (d.effective_from && deliveryDate < d.effective_from) return false;
    if (d.effective_to && deliveryDate > d.effective_to) return false;
    if (d.target_quantity == null || d.target_quantity <= 0) return false;
    if (!d.target_unit || !VALID_UNITS.has(d.target_unit as YieldUnit)) return false;
    return true;
  });

  const sums = new Map<YieldUnit, number>();
  for (const d of matching) {
    const u = d.target_unit as YieldUnit;
    sums.set(u, (sums.get(u) ?? 0) + Number(d.target_quantity ?? 0));
  }
  return Array.from(sums.entries()).map(([unit, quantity]) => ({ unit, quantity }));
}

/**
 * Tray-equivalents math for the alternatives model: 1 tray = 4 LG OR 8 SM.
 * Each demand line contributes (quantity / yield_per_tray[unit]) tray-units.
 * Sum across units, ceil, that's trays_needed. Lines whose unit isn't in
 * yield_per_tray contribute a fallback of 1 tray each (keeps the task visible
 * with the missing_yield_config flag set).
 */
function computeTraysNeeded(
  crop: MicrogreenCrop,
  demands: DemandLine[],
): { trays_needed: number; missing_yield_config: boolean } {
  let trayEquivalents = 0;
  let missing = false;
  const yieldMap = crop.yield_per_tray ?? {};
  for (const d of demands) {
    const yieldForUnit = Number(yieldMap[d.unit] ?? 0);
    if (yieldForUnit > 0) {
      trayEquivalents += d.quantity / yieldForUnit;
    } else {
      trayEquivalents += 1; // fallback
      missing = true;
    }
  }
  return { trays_needed: Math.ceil(trayEquivalents), missing_yield_config: missing };
}

function traysInFlightFor(
  crop: MicrogreenCrop,
  deliveryDate: string,
  batches: MicrogreenBatch[],
  trays: MicrogreenTray[],
): number {
  const relevantBatchIds = new Set(
    batches.filter((b) => b.crop_id === crop.id && b.planned_harvest_date === deliveryDate).map((b) => b.id),
  );
  return trays.filter(
    (t) => relevantBatchIds.has(t.batch_id) && t.status !== "terminated" && t.status !== "lost",
  ).length;
}

function isOverdueAdvance(
  tray: MicrogreenTray,
  crop: MicrogreenCrop,
  now: Date,
): boolean {
  if (tray.status === "soaking") {
    const startedAt = new Date(tray.created_at).getTime();
    const requiredMs = (crop.presoak_hours + crop.presprout_hours) * 3600 * 1000;
    return now.getTime() - startedAt > requiredMs;
  }
  if (tray.status === "blackout") {
    const blackoutStart = tray.blackout_start ?? tray.sow_date;
    const todayIso = isoDateUtc(now);
    return daysBetween(blackoutStart, todayIso) > crop.blackout_days;
  }
  return false;
}

export function computeSowPlan(input: SowPlanInput): SowPlan {
  const { crops, demand, batches, trays, deliveryDates, now } = input;
  const todayIso = isoDateUtc(now);

  const sow_today: SowTask[] = [];
  const overdueSow: SowTask[] = [];
  const warnings: SowTask[] = [];

  for (const crop of crops) {
    if (!crop.is_active) continue;
    for (const delivery_date of deliveryDates) {
      const daysOut = daysBetween(todayIso, delivery_date);
      if (daysOut < 0 || daysOut > PLAN_HORIZON_DAYS) continue;

      const expected_demands = effectiveDemandFor(crop, delivery_date, demand);
      if (expected_demands.length === 0) continue;

      const sow_date = addDays(delivery_date, -crop.ideal_harvest_day);
      const { trays_needed, missing_yield_config } = computeTraysNeeded(crop, expected_demands);
      const trays_in_flight = traysInFlightFor(crop, delivery_date, batches, trays);
      const trays_to_sow = Math.max(0, trays_needed - trays_in_flight);

      if (trays_to_sow <= 0) continue;

      const task: SowTask = {
        crop, delivery_date, sow_date,
        trays_to_sow, trays_in_flight, trays_needed,
        expected_demands, missing_yield_config,
      };
      if (sow_date === todayIso) sow_today.push(task);
      else if (sow_date < todayIso) overdueSow.push(task);
      if (missing_yield_config) warnings.push(task);
    }
  }

  const cropById = new Map(crops.map((c) => [c.id, c]));
  const batchById = new Map(batches.map((b) => [b.id, b]));

  const advance_today: AdvanceTask[] = [];
  const overdueAdvance: AdvanceTask[] = [];
  const harvest_today: HarvestTask[] = [];
  const overdueHarvest: HarvestTask[] = [];

  for (const tray of trays) {
    const batch = batchById.get(tray.batch_id);
    if (!batch) continue;
    const crop = cropById.get(batch.crop_id);
    if (!crop) continue;

    if (isReadyToAdvance(tray, crop, now)) {
      const to = nextStatus(crop, tray.status);
      if (to === "blackout" || to === "light") {
        advance_today.push({
          tray, crop,
          from_status: tray.status as "soaking" | "blackout",
          to_status: to,
        });
      }
    } else if (
      (tray.status === "soaking" || tray.status === "blackout") &&
      isOverdueAdvance(tray, crop, now)
    ) {
      const to = nextStatus(crop, tray.status);
      if (to === "blackout" || to === "light") {
        overdueAdvance.push({
          tray, crop,
          from_status: tray.status as "soaking" | "blackout",
          to_status: to,
        });
      }
    }

    if (isReadyToHarvest(tray, crop, now)) {
      const days_since_sow = daysBetween(tray.sow_date, todayIso);
      const kind: HarvestTask["kind"] =
        crop.is_continuous_harvest && tray.status === "harvesting"
          ? "continuous-ongoing"
          : "single-cut";
      harvest_today.push({ tray, crop, kind, days_since_sow });
    }
  }

  return {
    sow_today,
    advance_today,
    harvest_today,
    overdue: { sow: overdueSow, advance: overdueAdvance, harvest: overdueHarvest },
    warnings,
  };
}
