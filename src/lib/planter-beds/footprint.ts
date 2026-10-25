/**
 * Ground footprint of the restaurant planter boxes, parsed from the free-text
 * `planter_boxes.size` column, so reports can count the boxes in the farm's
 * growing acreage (Production/Acre).
 *
 * Size strings look like:
 *   "Long · 2'6\" × 12' × 1'4\" deep · 40 cu ft"
 *   "6-ft · 23.5\" × 68\" × 24\" · 169 gal"
 * The first "A × B" pair is the footprint (width × length); the third
 * dimension is depth and is ignored.
 */

export const SQ_FT_PER_ACRE = 43_560;

/** Cultivated field acreage, excluding the restaurant planter boxes. */
export const FIELD_ACRES = 0.5;

/** One dimension in feet: 12', 2'6", 23.5", 7 ft, 30 in. Null if unparseable. */
export function parseDimensionFeet(raw: string): number | null {
  const s = raw.trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  const m = s.match(/^(?:(\d+(?:\.\d+)?)\s*(?:'|ft\b))?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in\b))?$/i);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const feet = m[1] ? parseFloat(m[1]) : 0;
  const inches = m[2] ? parseFloat(m[2]) : 0;
  const total = feet + inches / 12;
  return total > 0 ? total : null;
}

/** Footprint in square feet from a box size string, or null if unparseable. */
export function boxFootprintSqFt(size: string | null | undefined): number | null {
  if (!size) return null;
  // Take the segment holding the "×" dimensions (segments split on "·").
  const segment = size.split("·").find((p) => /[×x]/i.test(p) && /\d/.test(p));
  if (!segment) return null;
  const dims = segment.split(/\s*[×x]\s*/i).map((d) => d.replace(/\bdeep\b/i, ""));
  if (dims.length < 2) return null;
  const a = parseDimensionFeet(dims[0]);
  const b = parseDimensionFeet(dims[1]);
  if (a === null || b === null) return null;
  return a * b;
}

export interface PlanterFootprint {
  sqFt: number;
  acres: number;
  /** Boxes counted. */
  counted: number;
  /** Box names whose size couldn't be parsed (not counted). */
  unparsed: string[];
}

export function planterFootprint(
  boxes: Array<{ name: string; size: string | null; is_active?: boolean | null }>,
): PlanterFootprint {
  let sqFt = 0;
  let counted = 0;
  const unparsed: string[] = [];
  for (const b of boxes) {
    if (b.is_active === false) continue;
    const f = boxFootprintSqFt(b.size);
    if (f === null) {
      unparsed.push(b.name);
      continue;
    }
    sqFt += f;
    counted++;
  }
  return { sqFt, acres: sqFt / SQ_FT_PER_ACRE, counted, unparsed };
}
