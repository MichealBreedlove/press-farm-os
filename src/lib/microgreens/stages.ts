import type {
  MicrogreenCrop,
  MicrogreenTray,
  MicrogreenTrayStatus,
} from "@/types/database";

export function initialStatusForCrop(crop: MicrogreenCrop): MicrogreenTrayStatus {
  if (crop.presoak_hours > 0 || crop.presprout_hours > 0) return "soaking";
  return "blackout";
}

export function nextStatus(
  crop: MicrogreenCrop,
  current: MicrogreenTrayStatus,
): MicrogreenTrayStatus | null {
  switch (current) {
    case "soaking":   return "blackout";
    case "blackout":  return crop.keep_in_blackout ? "harvesting" : "light";
    case "light":     return "harvesting";
    case "harvesting":return "terminated";
    default:          return null;
  }
}

const MS_PER_HOUR = 3600 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const today = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((today - from) / MS_PER_DAY);
}

export function isReadyToAdvance(
  tray: MicrogreenTray,
  crop: MicrogreenCrop,
  now: Date,
): boolean {
  if (tray.status === "soaking") {
    const startedAt = new Date(tray.created_at).getTime();
    const requiredHours = crop.presoak_hours + crop.presprout_hours;
    return (now.getTime() - startedAt) / MS_PER_HOUR >= requiredHours;
  }
  if (tray.status === "blackout") {
    const elapsed = daysBetween(tray.blackout_start ?? tray.sow_date, now);
    return elapsed >= crop.blackout_days;
  }
  // 'light' -> 'harvesting' goes through harvest event, not advance.
  return false;
}

export function isReadyToHarvest(
  tray: MicrogreenTray,
  crop: MicrogreenCrop,
  now: Date,
): boolean {
  // Any tray a grower has moved into 'harvesting' is ready to cut — this covers
  // continuous crops AND single-cut trays the grower has confirmed at baby green
  // (which now linger in 'harvesting' until the harvest is logged).
  if (tray.status === "harvesting") return true;

  if (tray.status === "light" || (crop.keep_in_blackout && tray.status === "blackout")) {
    const elapsed = daysBetween(tray.sow_date, now);
    return elapsed >= crop.ideal_harvest_day;
  }
  return false;
}
