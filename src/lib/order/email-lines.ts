/**
 * Line items for the order emails (admin "New order" + chef confirmation).
 *
 * The unit shown must be the unit the chef ORDERED (`order_items.unit_type`),
 * not the first unit on the item master. Multi-unit items are stored as
 * "sm,lg", so reading the master printed every such line as SM even when the
 * chef ordered LG (found 2026-11-21: a Press order of 4 LG lines emailed as
 * all SM). The master's first unit is only a fallback for a line with no
 * unit of its own. Size / color / variety ride on the name so the email says
 * which Moonshadow, which Mint.
 * Pure — tested in tests/lib/order-email-lines.test.ts.
 */

export interface OrderEmailLineInput {
  availability_item_id: string;
  quantity_requested: number;
  unit_type?: string | null;
  size_label?: string | null;
  color_key?: string | null;
  variety_key?: string | null;
  menu_section?: string | null;
}

export interface OrderEmailItemMaster {
  name?: string | null;
  unit_type?: string | null;
}

export interface OrderEmailItem {
  itemName: string;
  quantity: number;
  unit: string;
}

function clean(v: string | null | undefined): string {
  return String(v ?? "").trim();
}

export function buildOrderEmailItems(
  lines: OrderEmailLineInput[],
  masters: Map<string, OrderEmailItemMaster | null | undefined>,
): OrderEmailItem[] {
  return lines.map((line) => {
    const master = masters.get(line.availability_item_id);
    const firstMasterUnit = clean(master?.unit_type).split(",")[0]?.trim() ?? "";
    const unit = clean(line.unit_type) || firstMasterUnit;

    const details = [line.size_label, line.variety_key, line.color_key]
      .map(clean)
      .filter(Boolean);
    let itemName = clean(master?.name) || "Unknown item";
    if (details.length > 0) itemName += ` · ${details.join(" · ")}`;
    if (line.menu_section === "events") itemName += " (Events)";

    return { itemName, quantity: line.quantity_requested, unit };
  });
}
