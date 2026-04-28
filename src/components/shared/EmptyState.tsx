import Link from "next/link";
import { ReactNode } from "react";

const FLOWER_OPTIONS = [
  "/assets/flowers/nasturtium.png",
  "/assets/flowers/squash-blossom.png",
  "/assets/flowers/marigold.png",
  "/assets/flowers/violas.png",
  "/assets/flowers/pea-flower.png",
  "/assets/flowers/bachelor-buttons.png",
];

interface EmptyStateProps {
  icon?: ReactNode;
  /** Use a bundled flower illustration as the visual */
  flower?: "nasturtium" | "squash-blossom" | "marigold" | "violas" | "pea-flower" | "bachelor-buttons" | "random";
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
    ? FLOWER_OPTIONS[Math.floor(Math.random() * FLOWER_OPTIONS.length)]
    : flower
    ? `/assets/flowers/${flower}.png`
    : null;

  return (
    <div className="text-center py-10 px-4">
      {flowerSrc ? (
        <div className="mx-auto w-20 h-20 rounded-full bg-farm-cream border border-farm-dark/5 shadow-sm flex items-center justify-center mb-4 overflow-hidden">
          <img
            src={flowerSrc}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain p-1.5"
          />
        </div>
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
