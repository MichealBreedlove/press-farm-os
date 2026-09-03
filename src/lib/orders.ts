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

/**
 * Stale availability-id recovery for order submission.
 *
 * A chef's cart can carry availability ids that no longer match the delivery
 * date being submitted: the form was rendered from a prior date's rows
 * (rollover before materialization), the admin republished the date, or a
 * tab sat open across a cycle. The ITEM the chef picked is still knowable —
 * every availability row names its item_id — so rather than bouncing the
 * whole order, map each stale id to the current date's row for the same
 * item, and only refuse the lines whose item is genuinely gone or turned
 * unavailable.
 *
 * `staleRows` are the rows behind the ids that failed validation (any date,
 * same restaurant — RLS already scopes the chef's read). `currentRows` are
 * this restaurant's rows for the delivery date being submitted, all
 * statuses.
 */
export interface StaleAvailabilityRow {
  id: string;
  item_id: string;
}

export interface CurrentAvailabilityRow {
  id: string;
  item_id: string;
  status: string;
  item?: { name?: string | null } | null;
}

export interface StaleIdResolution {
  /** stale id → current-date id, for ids whose item is orderable today */
  remap: Map<string, string>;
  /** Names of items that exist for the date but are marked unavailable */
  unavailableNames: string[];
  /** Ids that could not be resolved at all (unknown row, or item has no row for the date) */
  unresolved: string[];
}

export function resolveStaleAvailabilityIds(
  staleIds: string[],
  staleRows: StaleAvailabilityRow[],
  currentRows: CurrentAvailabilityRow[],
): StaleIdResolution {
  const itemByStaleId = new Map(staleRows.map((r) => [r.id, r.item_id]));
  const currentByItem = new Map(currentRows.map((r) => [r.item_id, r]));

  const remap = new Map<string, string>();
  const unavailableNames: string[] = [];
  const unresolved: string[] = [];

  for (const staleId of staleIds) {
    const itemId = itemByStaleId.get(staleId);
    const current = itemId ? currentByItem.get(itemId) : undefined;
    if (!current) {
      unresolved.push(staleId);
      continue;
    }
    if (current.status === "unavailable") {
      const name = current.item?.name;
      if (name) unavailableNames.push(name);
      else unresolved.push(staleId);
      continue;
    }
    remap.set(staleId, current.id);
  }

  return { remap, unavailableNames, unresolved };
}
