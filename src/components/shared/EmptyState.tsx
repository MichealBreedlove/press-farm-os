import Link from "next/link";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Friendly empty state with optional icon, description, and CTA.
 * Used across pages to replace plain "No items" text.
 */
export function EmptyState({ icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-farm-green-light flex items-center justify-center mb-4">
        {icon ?? <span className="text-2xl">🌿</span>}
      </div>
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
