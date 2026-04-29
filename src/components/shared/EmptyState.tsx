import Link from "next/link";
import { ReactNode } from "react";

const FLOWERS_BASE = "/assets/pressfarm/flowers";

/** Full set of 28 flower illustrations available for empty states. */
const ALL_FLOWERS = [
  "allium", "alyssum", "anise-hyssop", "bachelor-button", "borage",
  "buttercup", "calendula", "california-poppy", "chamomile", "chervil",
  "chive-blossom", "dill", "fairy-vetch", "fava-flower", "fennel",
  "garlic-chive", "gem-marigold", "green-leaf", "lavender", "marigold",
  "mustard-flower", "nasturtium", "nasturtium-leaf", "pansy", "pea-flower",
  "rosemary", "squash-blossom", "squash-bud", "thai-basil", "thyme", "viola",
] as const;

export type FlowerName = typeof ALL_FLOWERS[number] | "random";

interface EmptyStateProps {
  icon?: ReactNode;
  /** Use a bundled flower illustration as the visual */
  flower?: FlowerName;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Friendly empty state with floral illustration, description, and CTA.
 */
export function EmptyState({ icon, flower, title, description, actionLabel, actionHref }: EmptyStateProps) {
  const flowerSrc = flower === "random"
    ? `${FLOWERS_BASE}/${ALL_FLOWERS[Math.floor(Math.random() * ALL_FLOWERS.length)]}.png`
    : flower
    ? `${FLOWERS_BASE}/${flower}.png`
    : null;

  return (
    <div className="text-center py-10 px-4">
      {flowerSrc ? (
        <img
          src={flowerSrc}
          alt=""
          aria-hidden="true"
          className="mx-auto h-24 w-auto mb-4"
        />
      ) : (
        <div className="mx-auto w-16 h-16 rounded-full bg-farm-green-light flex items-center justify-center mb-4">
          {icon ?? <span className="text-2xl">🌿</span>}
        </div>
      )}
      <h3 className="text-base font-semibold text-farm-dark">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="btn-primary inline-flex items-center justify-center mt-5 px-5 text-sm"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
