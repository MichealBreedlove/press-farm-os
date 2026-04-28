import Image from "next/image";

interface PressFarmLogoProps {
  /**
   * "lg" — full hero lockup with floral, wordmark, and tagline
   * "md" — compact lockup (default)
   * "icon" — squash blossom only (mobile/tight spaces)
   */
  size?: "lg" | "md" | "icon";
  /** Use light text + gold rules (for green/dark backgrounds) */
  onDark?: boolean;
  /** Hide tagline (smaller spaces) */
  hideTagline?: boolean;
  /** ARIA label for the whole logo */
  ariaLabel?: string;
  className?: string;
}

/**
 * Press Farm logo — production lockup with live Bank Gothic LT typography.
 *
 * Floral mark is rendered as <Image> (sharp at all sizes via Next.js).
 * "PRESS FARM" + "CULTIVATED WITH CHEFS" are live HTML text styled with
 * the @font-face Bank Gothic LT loaded in globals.css.
 *
 * Responsive: at <640px, defaults to "icon" only unless explicit size given.
 */
export function PressFarmLogo({
  size = "md",
  onDark = false,
  hideTagline = false,
  ariaLabel = "Press Farm — Cultivated with Chefs",
  className = "",
}: PressFarmLogoProps) {
  // Icon-only render
  if (size === "icon") {
    const src = onDark
      ? "/assets/logo/png/logo-floral-only-monochrome-light.png"
      : "/assets/logo/logo-icon-squash-blossom-transparent.png";
    return (
      <Image
        src={src}
        alt={ariaLabel}
        width={64}
        height={64}
        className={`block ${className}`}
        priority
      />
    );
  }

  const sizeClass = size === "lg" ? "pressfarm-logo--lg" : "";
  const darkClass = onDark ? "pressfarm-logo--on-dark" : "";

  const floralSrc = onDark
    ? "/assets/logo/png/logo-floral-only-monochrome-light.png"
    : "/assets/logo/png/logo-floral-only-transparent.png";

  return (
    <div
      className={`pressfarm-logo ${sizeClass} ${darkClass} ${className}`.trim()}
      aria-label={ariaLabel}
      role="img"
    >
      <Image
        src={floralSrc}
        alt=""
        aria-hidden="true"
        width={size === "lg" ? 200 : 96}
        height={size === "lg" ? 200 : 96}
        className="pressfarm-logo__floral"
        priority={size === "lg"}
      />
      <span className="pressfarm-logo__wordmark">PRESS FARM</span>
      {!hideTagline && (
        <span className="pressfarm-logo__tagline">CULTIVATED WITH CHEFS</span>
      )}
    </div>
  );
}

/**
 * Responsive logo: full lockup on desktop (≥640px), icon on mobile (<640px).
 * Use in nav / header areas where space is tight on phones.
 */
export function PressFarmLogoResponsive({
  onDark = false,
  className = "",
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <>
      {/* Mobile: icon only */}
      <span className={`sm:hidden ${className}`}>
        <PressFarmLogo size="icon" onDark={onDark} />
      </span>
      {/* Desktop: full lockup, hide tagline in tight nav */}
      <span className={`hidden sm:inline-flex ${className}`}>
        <PressFarmLogo size="md" onDark={onDark} hideTagline />
      </span>
    </>
  );
}
