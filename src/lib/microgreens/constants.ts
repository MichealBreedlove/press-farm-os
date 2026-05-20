import type { MicrogreenTrayStatus } from "@/types/database";

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

export const PLAN_HORIZON_DAYS = 21;

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const GROWING_MEDIA = ["soil", "hydroponic"] as const;
export type GrowingMedium = (typeof GROWING_MEDIA)[number];
