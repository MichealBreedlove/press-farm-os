import Image from "next/image";

// Under-Study logo: 276×140px (stacked mark + wordmark)
// Press / Events / Press Bar render as Bank Gothic LT typography
// (see TypographicMark below) so the lookalike pseudo-restaurants
// read as a consistent set across admin restaurant cards.

interface RestaurantWordmarkProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

export function RestaurantWordmark({ name, size = "md" }: RestaurantWordmarkProps) {
  const normalized = name.toLowerCase().replace(/[-\s]/g, "");

  // Press uses the same typographic treatment as Events / Press Bar so
  // the three lookalike pseudo-restaurants render consistently in the
  // /admin/orders card row. Under-Study still uses its dedicated logo
  // PNG below — it's a stacked mark with brand artwork that doesn't
  // translate cleanly to a Bank Gothic wordmark.
  // The TypographicMark component is defined further down — render it
  // directly via JSX once we hit a match.

  if (normalized === "understudy") {
    const height = size === "sm" ? 40 : size === "lg" ? 64 : 52;
    const width = Math.round(height * (276 / 140));
    return (
      <Image
        src="/logo-under-study.png"
        alt="Under-Study"
        width={width}
        height={height}
        className="object-contain"
      />
    );
  }

  // Shared typographic wordmark for Press / Events / Press Bar (and any
  // future pseudo-restaurant without a designed logo PNG). Bank Gothic LT
  // is loaded as a single Light weight, so font-weight:bold has no effect
  // on the strokes — we simulate a heavier "logo-grade" weight via
  // -webkit-text-stroke. This brings the visual heft closer to the
  // Under-Study logo PNG that shares the same restaurant card row.
  function TypographicMark({ label }: { label: string }) {
    const px = size === "sm" ? 17 : size === "lg" ? 28 : 22;
    // Stroke width scales with size so the "bold-ness" stays proportional
    // and we don't end up with an over-blocky small variant.
    const strokePx = size === "sm" ? 0.35 : size === "lg" ? 0.6 : 0.45;
    return (
      <span
        className="font-normal text-farm-dark tracking-[0.25em] uppercase"
        style={{
          fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', Arial, sans-serif",
          fontSize: `${px}px`,
          lineHeight: 1,
          // -webkit-text-stroke draws a synthetic stroke around each glyph
          // outline; same color as the fill so it just thickens. paint-order
          // keeps the stroke under the fill so glyph edges stay crisp.
          WebkitTextStroke: `${strokePx}px currentColor`,
          paintOrder: "stroke fill",
        }}
      >
        {label}
      </span>
    );
  }

  if (normalized === "press") return <TypographicMark label="PRESS" />;
  if (normalized === "events") return <TypographicMark label="EVENTS" />;
  if (normalized === "pressbar") return <TypographicMark label="PRESS BAR" />;

  return (
    <span className="font-sans font-semibold text-farm-dark">{name}</span>
  );
}
