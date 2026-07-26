/**
 * Press Farm OS — production-value server aggregation.
 *
 * Fetches the two production-value sources (microgreen trays with a
 * value_per_tray, planter-box plantings) and runs the pure accrual core over
 * them, returning per-month and per-source/per-restaurant rollups. Shared by
 * the dedicated production-value report and the executive summary.
 *
 * Computed on the fly — no stored daily rows, no cron. Data volumes are small.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { todayPacific } from "@/lib/utils";
import {
  trayAccrual,
  plantingAccrual,
  valueByMonth,
  mergeMonthMaps,
  PRODUCTION_VALUE_SPLIT_DEFAULT,
  type ProductionSplit,
  type DailyAccrual,
} from "./accrual";

export interface ProductionLineItem {
  /** display name (crop or planting) */
  name: string;
  /** "Microgreens" | "Planter Boxes" */
  source: "Microgreens" | "Planter Boxes";
  /** optional sub-label (box name, lifecycle) */
  detail?: string;
  total: number;
  byMonth: Record<string, number>;
}

export interface ProductionValueData {
  /** every contributing tray/planting, with its own monthly accrual */
  items: ProductionLineItem[];
  /** combined value per YYYY-MM (all sources) */
  byMonth: Record<string, number>;
  /** combined value per YYYY-MM, microgreens only */
  microByMonth: Record<string, number>;
  /** combined value per YYYY-MM, planter boxes only */
  boxByMonth: Record<string, number>;
  /** grand total across all time */
  total: number;
  microTotal: number;
  boxTotal: number;
  /** restaurant split applied to the grand total */
  split: ProductionSplit;
  byRestaurant: ProductionSplit;
}

/** Read the 75/25 split from farm_settings, falling back to the code default. */
async function loadSplit(admin: ReturnType<typeof createAdminClient>): Promise<ProductionSplit> {
  const { data } = await (admin as any)
    .from("farm_settings")
    .select("key, value")
    .in("key", ["production_split_press", "production_split_understudy"]);

  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value;
  const press = Number(map["production_split_press"]);
  const understudy = Number(map["production_split_understudy"]);
  if (Number.isFinite(press) && Number.isFinite(understudy) && press + understudy > 0) {
    return { press, understudy };
  }
  return { ...PRODUCTION_VALUE_SPLIT_DEFAULT };
}

const tsToDate = (v: string | null | undefined): string | null =>
  v ? v.slice(0, 10) : null;

const sumMap = (m: Record<string, number>): number =>
  Object.values(m).reduce((s, v) => s + v, 0);

/**
 * Compute production value across all sources. `today` defaults to the current
 * UTC date and caps accrual so future/projected days aren't counted.
 */
export async function getProductionValue(today?: string): Promise<ProductionValueData> {
  const admin = createAdminClient();
  const cap = today ?? todayPacific();

  const [{ data: trays }, { data: plantings }, split] = await Promise.all([
    // Trays of crops that carry a value_per_tray and have started harvesting.
    (admin as any)
      .from("microgreen_trays")
      .select(
        "id, harvesting_start, terminated_at, status, " +
          "microgreen_batches(microgreen_crops(name, value_per_tray, productive_life_days))",
      )
      .not("harvesting_start", "is", null),
    (admin as any)
      .from("planter_box_plantings")
      .select("id, name, lifecycle, planted_date, end_date, value_amount, seasonal_months, planter_boxes(name)"),
    loadSplit(admin),
  ]);

  const items: ProductionLineItem[] = [];

  for (const t of trays ?? []) {
    const crop = (t.microgreen_batches as any)?.microgreen_crops;
    if (!crop?.value_per_tray) continue;
    const acc = trayAccrual({
      valuePerTray: Number(crop.value_per_tray),
      productiveLifeDays: crop.productive_life_days,
      harvestingStart: tsToDate(t.harvesting_start),
      terminatedAt: tsToDate(t.terminated_at),
      today: cap,
    });
    if (!acc) continue;
    const byMonth = valueByMonth(acc, cap);
    const total = sumMap(byMonth);
    if (total <= 0) continue;
    items.push({ name: crop.name, source: "Microgreens", detail: "tray", total, byMonth });
  }

  for (const p of plantings ?? []) {
    const acc: DailyAccrual | null = plantingAccrual({
      lifecycle: p.lifecycle,
      valueAmount: Number(p.value_amount),
      plantedDate: p.planted_date,
      endDate: p.end_date,
      seasonalMonths: p.seasonal_months,
      today: cap,
    });
    if (!acc) continue;
    const byMonth = valueByMonth(acc, cap);
    const total = sumMap(byMonth);
    if (total <= 0) continue;
    items.push({
      name: p.name,
      source: "Planter Boxes",
      detail: (p.planter_boxes as any)?.name ?? undefined,
      total,
      byMonth,
    });
  }

  const microItems = items.filter((i) => i.source === "Microgreens");
  const boxItems = items.filter((i) => i.source === "Planter Boxes");

  const microByMonth = mergeMonthMaps(microItems.map((i) => i.byMonth));
  const boxByMonth = mergeMonthMaps(boxItems.map((i) => i.byMonth));
  const byMonth = mergeMonthMaps([microByMonth, boxByMonth]);

  const microTotal = sumMap(microByMonth);
  const boxTotal = sumMap(boxByMonth);
  const total = microTotal + boxTotal;

  // Sort items by contribution, descending.
  items.sort((a, b) => b.total - a.total);

  return {
    items,
    byMonth,
    microByMonth,
    boxByMonth,
    total,
    microTotal,
    boxTotal,
    split,
    byRestaurant: { press: total * split.press, understudy: total * split.understudy },
  };
}

/** Roll a per-`YYYY-MM` map up into per-year totals. */
export function byMonthToByYear(byMonth: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [m, v] of Object.entries(byMonth)) {
    const y = m.slice(0, 4);
    out[y] = (out[y] ?? 0) + v;
  }
  return out;
}
