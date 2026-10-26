import type { MicrogreenHarvestStage, MicrogreenTrayStatus } from "@/types/database";

export const TRAY_STATUSES: MicrogreenTrayStatus[] = [
  "soaking", "blackout", "light", "harvesting", "terminated", "lost",
];

export const TRAY_STATUS_LABELS: Record<MicrogreenTrayStatus, string> = {
  soaking: "Soaking",
  blackout: "Blackout",
  light: "Light",
  harvesting: "Harvesting",
  terminated: "Done",
  lost: "Lost",
};

export const TRAY_STATUS_COLORS: Record<MicrogreenTrayStatus, string> = {
  soaking: "badge-blue",
  blackout: "bg-farm-dark/15 text-farm-dark",
  light: "badge-gold",
  harvesting: "badge-green",
  terminated: "bg-farm-muted/15 text-farm-muted",
  lost: "badge-red",
};

export const FORECAST_LOOKBACK_WEEKS = 8;
export const FORECAST_WARNING_RATIO = 1.25; // forecast > manual * 1.25 -> warn

// Must cover the longest ideal_harvest_day of any active crop — a delivery
// further out than this is never planned, so its sow task never appears
// (Shiso grows 27 days; 21 silently dropped it).
export const PLAN_HORIZON_DAYS = 35;

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const GROWING_MEDIA = ["soil", "hydroponic"] as const;
export type GrowingMedium = (typeof GROWING_MEDIA)[number];

export const HARVEST_STAGE_LABELS: Record<MicrogreenHarvestStage, string> = {
  cotyledon: "Cotyledon",
  true_leaf: "True Leaf",
  baby_green: "Baby Green",
};

export const HARVEST_STAGE_CHIP_CLASS: Record<MicrogreenHarvestStage, string> = {
  cotyledon: "bg-farm-muted/10 text-farm-muted",
  true_leaf: "bg-farm-green/10 text-farm-green",
  baby_green: "bg-farm-green/20 text-farm-green font-medium",
};
