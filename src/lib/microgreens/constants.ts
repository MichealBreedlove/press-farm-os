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

/**
 * How far ahead computeSowPlan() looks for delivery dates.
 *
 * MUST exceed the longest ideal_harvest_day among crops that carry demand,
 * otherwise those crops can never be planned on time: the delivery only enters
 * the window after its sow date has already passed, so every run emits a fresh
 * *overdue* sow task and the board can never be cleared. At 21 this silently
 * broke Shiso (29d), Fennel (23d) and Chervil (22d) — each generated a new
 * permanently-late task every week.
 *
 * 35 clears the current maximum (Shiso Purple, 29d) with a week of slack. Raise
 * it if a longer-lead crop gets demand — Sorrel is 36d, and Anise Hyssop /
 * Lemon Balm are 61d.
 */
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
