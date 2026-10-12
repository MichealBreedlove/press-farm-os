/**
 * Pure grouping for the chef-facing "In the Planter Beds" list on the order
 * sheet: what is growing in each restaurant planter box right now, so chefs
 * can pick it themselves instead of ordering it.
 */

export interface PlanterBedPlantingRow {
  /** Planting name, e.g. "Lemon Basil". */
  name: string;
  /** Box name, e.g. "ST15", "U9", "G2". */
  box: string;
  /** Months (1-12) the planting is pickable; empty/null = all year. */
  seasonalMonths?: number[] | null;
}

export interface PlanterBed {
  box: string;
  items: string[];
}

export interface PlanterBedGroup {
  /** Series prefix: "ST", "G", "U", or "" for anything unprefixed. */
  series: string;
  label: string;
  beds: PlanterBed[];
}

const SERIES_LABELS: Record<string, string> = {
  ST: "Stock tanks · PRESS back garden",
  G: "By the greenhouse · PRESS back garden",
  U: "Under-Study beds",
};

/** Default walk: stock tanks, greenhouse wall, then the Under-Study beds. */
const DEFAULT_SERIES_ORDER = ["ST", "G", "U"];

function parseBox(name: string): { series: string; num: number } {
  const m = name.trim().match(/^([A-Za-z]*)\s*(\d+)?/);
  return { series: (m?.[1] ?? "").toUpperCase(), num: m?.[2] ? Number(m[2]) : Infinity };
}

/** True when the planting can be picked in `month` (1-12). */
export function isInSeason(seasonalMonths: number[] | null | undefined, month: number): boolean {
  return !seasonalMonths || seasonalMonths.length === 0 || seasonalMonths.includes(month);
}

/**
 * Group in-season plantings by box series, then by box in number order
 * (ST2 before ST10), with each box's plantings alphabetical and de-duplicated.
 * `firstSeries` moves one series to the top — the chef's own beds first.
 */
export function groupPlanterBeds(
  rows: PlanterBedPlantingRow[],
  opts: { month: number; firstSeries?: string | null },
): PlanterBedGroup[] {
  const byBox = new Map<string, Set<string>>();
  for (const row of rows) {
    const box = row.box?.trim();
    const name = row.name?.trim();
    if (!box || !name || !isInSeason(row.seasonalMonths, opts.month)) continue;
    if (!byBox.has(box)) byBox.set(box, new Set());
    byBox.get(box)!.add(name);
  }

  const bySeries = new Map<string, PlanterBed[]>();
  for (const [box, names] of Array.from(byBox.entries())) {
    const { series } = parseBox(box);
    if (!bySeries.has(series)) bySeries.set(series, []);
    bySeries.get(series)!.push({ box, items: Array.from(names).sort((a, b) => a.localeCompare(b)) });
  }

  const rank = (series: string): number => {
    if (opts.firstSeries && series === opts.firstSeries.toUpperCase()) return -1;
    const i = DEFAULT_SERIES_ORDER.indexOf(series);
    return i === -1 ? DEFAULT_SERIES_ORDER.length : i;
  };

  return Array.from(bySeries.entries())
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([series, beds]) => ({
      series,
      label: SERIES_LABELS[series] ?? (series ? `${series} beds` : "Other beds"),
      beds: beds.sort(
        (a, b) => parseBox(a.box).num - parseBox(b.box).num || a.box.localeCompare(b.box),
      ),
    }));
}

/** Total distinct plantings across all groups (the banner's count). */
export function countPlanterBedItems(groups: PlanterBedGroup[]): number {
  return groups.reduce((sum, g) => sum + g.beds.reduce((s, b) => s + b.items.length, 0), 0);
}

/** Which series sits closest to a restaurant, by slug. */
export function firstSeriesForRestaurant(slug: string | null | undefined): string | null {
  return slug && /under/i.test(slug) ? "U" : null;
}
