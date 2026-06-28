/** Planting lifecycle UI labels + helpers (shared by forms and reports). */

export type PlantingLifecycle = "annual" | "perennial_evergreen" | "perennial_dormant";

export const LIFECYCLE_LABELS: Record<PlantingLifecycle, string> = {
  annual: "Annual",
  perennial_evergreen: "Perennial — evergreen",
  perennial_dormant: "Perennial — goes dormant",
};

export const LIFECYCLE_HINTS: Record<PlantingLifecycle, string> = {
  annual: "Total value spread evenly over the plant's life (needs an end date).",
  perennial_evergreen: "Monthly value, accrues year-round while active (e.g. rosemary).",
  perennial_dormant: "Monthly value, only during its growing-season months (e.g. verbena).",
};

/** Whether value_amount represents a one-time total or a monthly rate. */
export function valueBasisFor(lifecycle: PlantingLifecycle): "total" | "monthly" {
  return lifecycle === "annual" ? "total" : "monthly";
}

export const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
