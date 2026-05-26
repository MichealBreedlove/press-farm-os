import type { OrderAudit, OrderAuditAction } from "@/types";

/**
 * OrderActivity — compact, on-brand audit timeline for a single order.
 *
 * Renders the `order_audit` rows passed in as a vertical list of
 * "action · actor · time" entries. Used by both the chef order-detail page
 * and the admin per-date detail so the accountability story reads the same
 * everywhere. Server-friendly (no client hooks); times render in PT.
 */

const ACTION_LABELS: Record<OrderAuditAction, string> = {
  submitted: "Order placed",
  edited: "Order edited",
  merged: "Items added",
  shortage_marked: "Shortage marked",
  shortage_cleared: "Shortage cleared",
  status_changed: "Status changed",
  fulfilled: "Marked fulfilled",
  cancelled: "Order cancelled",
};

/** Dot color by action family — reuses the brand status palette, no ad-hoc colors. */
function dotClass(action: string): string {
  switch (action) {
    case "submitted":
    case "merged":
    case "edited":
      return "bg-pf-master-blue";
    case "fulfilled":
      return "bg-farm-green";
    case "cancelled":
      return "bg-red-700";
    case "shortage_marked":
      return "bg-pf-master-orange";
    case "shortage_cleared":
      return "bg-farm-green";
    default:
      return "bg-farm-muted";
  }
}

function actionLabel(action: string, detail: Record<string, unknown> | null): string {
  const base = ACTION_LABELS[action as OrderAuditAction] ?? action;
  if (action === "merged" && detail && typeof detail.added === "number") {
    const added = detail.added as number;
    const bumped = (detail.bumped as number) ?? 0;
    const parts: string[] = [];
    if (added > 0) parts.push(`${added} new`);
    if (bumped > 0) parts.push(`${bumped} updated`);
    return parts.length > 0 ? `${base} (${parts.join(", ")})` : base;
  }
  if (
    (action === "shortage_marked" || action === "shortage_cleared") &&
    detail &&
    typeof detail.item === "string"
  ) {
    return `${base} — ${detail.item}`;
  }
  if (action === "status_changed" && detail && typeof detail.status === "string") {
    return `${base} → ${detail.status}`;
  }
  return base;
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderActivity({
  entries,
  className = "",
  /** When true, drop the card chrome — for use nested inside an existing card. */
  bare = false,
}: {
  entries: OrderAudit[];
  className?: string;
  bare?: boolean;
}) {
  if (!entries || entries.length === 0) return null;

  // Newest first — most recent action at the top reads best for an order's story.
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const wrapperClass = bare ? `px-4 py-4 ${className}` : `card px-4 py-4 ${className}`;

  return (
    <div className={wrapperClass}>
      <p className="section-eyebrow with-flower text-farm-muted mb-3">Activity</p>
      <ul className="space-y-3">
        {sorted.map((e) => (
          <li key={e.id} className="flex items-start gap-2.5">
            <span
              className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClass(e.action)}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-farm-dark leading-snug">
                {actionLabel(e.action, (e.detail ?? null) as Record<string, unknown> | null)}
              </p>
              <p className="text-[11px] text-farm-muted mt-0.5">
                {e.actor_name ?? "Someone"} · {formatStamp(e.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
