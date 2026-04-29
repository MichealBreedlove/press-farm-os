import Link from "next/link";

interface EditorialHeroProps {
  /** Small Bank Gothic gold eyebrow (e.g. "Daily Operations") */
  eyebrow: string;
  /** Big Cormorant display title (e.g. "Orders") */
  title: string;
  /** Optional one-line summary or live stat (e.g. "3 pending · 12 fulfilled") */
  subtitle?: string;
  /** Optional flower slug from /assets/pressfarm/flowers/ to anchor the right side */
  flower?: string;
  /** Optional href for a back link (renders ‹ icon on the left) */
  backHref?: string;
  /** Optional right-side accessory (e.g. <PrintButton/>, <RefreshButton/>) */
  accessory?: React.ReactNode;
}

/**
 * Magazine-cover hero block for admin landing pages.
 * Sits below the green page-header bar and above page content.
 * Pairs Bank Gothic gold eyebrows with Cormorant display titles + optional
 * flower anchor + gold dot rule.
 */
export function EditorialHero({
  eyebrow,
  title,
  subtitle,
  flower,
  backHref,
  accessory,
}: EditorialHeroProps) {
  return (
    <section className="px-5 pt-7 pb-5 bg-farm-cream/60 border-b border-pf-master-gold/20">
      <div className="flex items-start gap-4 max-w-3xl mx-auto">
        {backHref && (
          <Link
            href={backHref}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-farm-muted hover:text-farm-dark mt-1 -ml-1"
            aria-label="Back"
          >
            ‹
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p
              className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold font-medium"
              style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
            >
              {eyebrow}
            </p>
            {accessory && <div className="flex-shrink-0">{accessory}</div>}
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight mt-1">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-farm-muted mt-2 leading-relaxed max-w-md">
              {subtitle}
            </p>
          )}
        </div>
        {flower && (
          <img
            src={`/assets/pressfarm/flowers/${flower}.png`}
            alt=""
            aria-hidden="true"
            className="w-20 sm:w-24 h-auto opacity-90 -mt-1 flex-shrink-0"
          />
        )}
      </div>
      {/* Gold dot rule */}
      <div className="max-w-3xl mx-auto mt-5 flex items-center gap-2">
        <div className="flex-1 h-px bg-pf-master-gold/30" />
        <div className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
        <div className="flex-1 h-px bg-pf-master-gold/30" />
      </div>
    </section>
  );
}
