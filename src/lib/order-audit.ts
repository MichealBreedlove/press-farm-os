/**
 * Press Farm OS — Order audit helper
 *
 * Records a single row in the `order_audit` table whenever an order is
 * submitted, edited, merged, status-changed, or has a shortage marked/cleared.
 *
 * Mirrors the email helpers' contract: audit writes must NEVER fail the order
 * request they accompany. Every call is wrapped so a DB hiccup is logged and
 * swallowed — accountability is best-effort, order integrity is not.
 *
 * Works with either a service-role client (admin routes) or a user client
 * (chef submit route). Chef RLS allows inserts scoped to their own restaurant;
 * the service role bypasses RLS entirely.
 */

import type { OrderAuditAction } from "@/types";

/** Loosely-typed Supabase client (server or admin) — both expose `.from()`. */
type AuditClient = { from: (table: string) => any };

export interface RecordOrderAuditParams {
  /** The order this action targets. Nullable so we can log a delete after the row is gone. */
  orderId?: string | null;
  /** Required — every audit row is scoped to a restaurant for RLS. */
  restaurantId: string;
  /** Delivery date the order is for (helps timeline grouping). */
  deliveryDate?: string | null;
  /** The user performing the action (chef or admin). */
  actorId?: string | null;
  /** Snapshot of the actor's display name at action time. */
  actorName?: string | null;
  /** Canonical audited action. */
  action: OrderAuditAction;
  /** Optional structured context — item counts, status, shortage item/reason, etc. */
  detail?: Record<string, unknown>;
}

/**
 * Insert one audit row. Resilient by design — resolves silently on failure.
 */
export async function recordOrderAudit(
  client: AuditClient,
  {
    orderId,
    restaurantId,
    deliveryDate,
    actorId,
    actorName,
    action,
    detail,
  }: RecordOrderAuditParams,
): Promise<void> {
  if (!restaurantId) {
    // Without a restaurant the row can't satisfy RLS or the NOT NULL constraint.
    console.error("[AUDIT] Skipped order audit — missing restaurant_id", { action });
    return;
  }

  try {
    const { error } = await client.from("order_audit").insert({
      order_id: orderId ?? null,
      restaurant_id: restaurantId,
      delivery_date: deliveryDate ?? null,
      actor_id: actorId ?? null,
      actor_name: actorName ?? null,
      action,
      detail: detail ?? {},
    });
    if (error) {
      console.error("[AUDIT] Failed to record order audit:", action, error);
    }
  } catch (err) {
    console.error("[AUDIT] Unexpected error recording order audit:", action, err);
  }
}
