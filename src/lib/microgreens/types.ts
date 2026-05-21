import type {
  MicrogreenCrop,
  MicrogreenBatch,
  MicrogreenTray,
  MicrogreenHarvest,
  MicrogreenDemand,
} from "@/types/database";

export type TrayWithBatch = MicrogreenTray & { batch?: MicrogreenBatch };
export type TrayWithCrop = MicrogreenTray & {
  batch?: MicrogreenBatch & { crop?: MicrogreenCrop };
};
export type HarvestWithTray = MicrogreenHarvest & { tray?: TrayWithCrop };
export type DemandWithRestaurant = MicrogreenDemand & {
  restaurant?: { id: string; name: string } | null;
};

export type YieldUnit = "lg" | "sm" | "ea";
export const YIELD_UNITS: YieldUnit[] = ["lg", "sm", "ea"];
export const YIELD_UNIT_LABELS: Record<YieldUnit, string> = {
  lg: "LG",
  sm: "SM",
  ea: "EA",
};

/**
 * A single demand line — "8 LG of Pea Shoots needed Monday".
 */
export type DemandLine = {
  quantity: number;
  unit: YieldUnit;
};

export type SowTask = {
  crop: MicrogreenCrop;
  delivery_date: string;     // ISO date
  sow_date: string;          // ISO date (== today for "today" tasks)
  trays_to_sow: number;
  trays_in_flight: number;
  trays_needed: number;
  /**
   * All demand lines for this crop on this delivery date, grouped by unit.
   * Example: [{quantity: 4, unit: 'lg'}, {quantity: 8, unit: 'sm'}].
   * Alternatives model: 1 tray = 4 LG OR 8 SM — they're tray-equivalents,
   * which sum to the trays_needed total.
   */
  expected_demands: DemandLine[];
  /**
   * True when one or more demand lines couldn't be converted to trays
   * because the crop's yield_per_tray map lacks an entry for that unit.
   * Trays_needed still includes a fallback of 1 tray per unmapped line
   * so the task stays visible.
   */
  missing_yield_config: boolean;
};

export type AdvanceTask = {
  tray: MicrogreenTray;
  crop: MicrogreenCrop;
  from_status: "soaking" | "blackout";
  to_status: "blackout" | "light";
};

export type HarvestTask = {
  tray: MicrogreenTray;
  crop: MicrogreenCrop;
  kind: "single-cut" | "continuous-ongoing";
  days_since_sow: number;
};

export type SowPlan = {
  sow_today: SowTask[];
  advance_today: AdvanceTask[];
  harvest_today: HarvestTask[];
  overdue: {
    sow: SowTask[];
    advance: AdvanceTask[];
    harvest: HarvestTask[];
  };
  warnings: SowTask[]; // for now: missing yield config tasks
};
