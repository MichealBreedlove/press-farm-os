/**
 * Order line → email line.
 *
 * Every order email (admin "new order", chef confirmation, fulfilled notice,
 * shortage notice) used to print the item's FIRST catalog unit and nothing
 * else — so an LG order of a "sm,lg" item read "SM", and the size / color /
 * variety the chef picked never appeared (two Mint lines looked identical).
 * 2026-11-19: Press ordered Chocolate Mint 1 LG + Baby Red Frills 2 LG and the
 * email said "Mint 1 SM" / "Red Frills Mustard 2 SM".
 *
 * The unit is the one stored on the line; the catalog's first unit is only the
 * fallback for legacy lines that carry none.
 */

import { formatSizeLabel } from "@/lib/leaf-sizes";

export interface EmailLineSource {
  /** Catalog item (items.name / category / unit_type — unit_type may be "sm,lg"). */
  item?: { name?: string | null; category?: string | null; unit_type?: string | null } | null;
  /** The ordered unit, order_items.unit_type. */
  unit_type?: string | null;
  size_label?: string | null;
  color_key?: string | null;
  variety_key?: string | null;
  menu_section?: string | null;
}

function tidyList(value: string | null | undefined): string {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

/** `{ itemName: 'Mint · Chocolate', unit: 'lg' }` */
export function orderEmailLine(line: EmailLineSource): { itemName: string; unit: string } {
  const item = line.item;
  const catalogFirst = String(item?.unit_type ?? "").split(",")[0]?.trim() ?? "";
  const unit = (line.unit_type ?? "").trim() || catalogFirst;

  const parts = [
    item?.name?.trim() || "Unknown item",
    formatSizeLabel(line.size_label?.trim(), item?.category),
    tidyList(line.color_key),
    tidyList(line.variety_key),
  ].filter(Boolean);

  let itemName = parts.join(" · ");
  if (line.menu_section === "events") itemName += " (Events)";
  return { itemName, unit };
}
