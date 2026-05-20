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

export type SowTask = {
  crop: MicrogreenCrop;
  delivery_date: string;     // ISO date
  sow_date: string;          // ISO date (== today for "today" tasks)
  trays_to_sow: number;
  trays_in_flight: number;
  trays_needed: number;
  expected_oz: number;
  manual_oz: number;
  forecast_oz: number;
  is_warning: boolean;       // forecast > manual * ratio
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
  warnings: SowTask[]; // forecast > manual * 1.25
};
