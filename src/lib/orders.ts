/**
 * Order-line merge planning.
 *
 * When a chef re-submits against an existing order ("merge mode"), incoming
 * lines that match an existing line on (availability item + unit + size +
 * color + menu section) have their quantities summed; unmatched lines are
 * appended. This is the pure decision core — the route applies the returned
 * plan via DB writes. Kept here (route files can't export helpers) so the
 * matching + summing can be unit-tested.
 */

export interface MergeableLine {
  availability_item_id: string;
  unit_type?: string | null;
  size_label?: string | null;
  color_key?: string | null;
  variety_key?: string | null;
  menu_section?: string | null;
  quantity_requested: number;
}

export interface ExistingOrderLine extends MergeableLine {
  id: string;
}

/**
 * The identity of an order line for merge purposes. Two lines merge iff every
 * discriminator matches (a null/absent value is normalized to ""), so SM and
 * LG of the same item — or the same item on the Events vs Regular menu — stay
 * distinct lines rather than collapsing together.
 */
export function orderLineKey(l: MergeableLine): string {
  return [
    l.availability_item_id,
    l.unit_type ?? "",
    l.size_label ?? "",
    l.color_key ?? "",
    l.variety_key ?? "",
    l.menu_section ?? "",
  ].join("|");
}

/**
 * Plan a merge of incoming lines against the order's existing lines.
 *
 * - Matched incoming line → an update summing its quantity onto the existing
 *   line's quantity.
 * - Unmatched incoming line → inserted as-is.
 *
 * Quantities are coerced with Number() to match the route's defensive parsing.
 */
export function planOrderItemMerge<T extends MergeableLine>(
  existing: ExistingOrderLine[],
  incoming: T[],
): { toInsert: T[]; toUpdate: { id: string; quantity_requested: number }[] } {
  const existingByKey = new Map<string, ExistingOrderLine>();
  for (const ei of existing) existingByKey.set(orderLineKey(ei), ei);

  const toInsert: T[] = [];
  const toUpdate: { id: string; quantity_requested: number }[] = [];

  for (const line of incoming) {
    const match = existingByKey.get(orderLineKey(line));
    if (match) {
      toUpdate.push({
        id: match.id,
        quantity_requested: Number(match.quantity_requested ?? 0) + Number(line.quantity_requested),
      });
    } else {
      toInsert.push(line);
    }
  }

  return { toInsert, toUpdate };
}
