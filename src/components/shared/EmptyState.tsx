import Link from "next/link";

interface EmptyStateProps {
  /** Flower slug from /assets/pressfarm/flowers/ (e.g. "bachelor-button") */
  flower?: string;
  title: string;
  /** One or two short sentences of guidance */
  body?: string;
  /** Optional call to action rendered as a secondary button */
  cta?: { label: string; href: string };
  /** Optional fine print or extra content below the body */
  children?: React.ReactNode;
}

/**
 * Branded empty state — flower illustration + title + guidance copy.
 * Use for any "nothing here yet" surface so empty screens feel
 * intentional rather than broken.
 */
export function EmptyState({
  flower = "bachelor-button",
  title,
  body,
  cta,
  children,
}: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <img
        src={`/assets/pressfarm/flowers/${flower}.png`}
        alt=""
        aria-hidden="true"
        className="mx-auto h-24 w-auto mb-4 opacity-60"
      />
      <h3 className="text-base font-semibold text-farm-dark">{title}</h3>
      {body && (
        <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">{body}</p>
      )}
      {children}
      {cta && (
        <Link
          href={cta.href}
          className="btn-secondary inline-flex items-center justify-center mt-5 text-sm"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
