"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

const FLOWER_POOL = [
  "alyssum", "anise-hyssop", "bachelor-button", "borage", "buttercup",
  "calendula", "california-poppy", "chamomile", "chervil", "chive-blossom",
  "dill", "hairy-vetch", "fava-flower", "fennel", "garlic-chive",
  "gem-marigold", "lavender", "marigold", "mustard-flower", "nasturtium",
  "pansy", "pea-flower", "rosemary", "squash-blossom", "thai-basil",
  "thyme",
];

interface FloralCornersProps {
  /** Density: how many corners to populate (default 4 = all corners). */
  density?: 2 | 3 | 4;
  /** Opacity 0–1 (default 0.10). Lower = more subtle. */
  opacity?: number;
  /** Don't render on these path prefixes (e.g. login already has its own florals). */
  excludePaths?: string[];
}

/** Day of year (1–366) in the browser's local time. */
function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((today - start) / 86400000);
}

/**
 * Deterministic 4-flower pick seeded by the day of year: the same four
 * species all day on every page, so the four PNGs are fetched once and then
 * served from the HTTP / service-worker cache instead of four fresh random
 * downloads on every hard load. Rotates daily so it still feels alive.
 */
function picksForToday(): string[] {
  const seed = dayOfYear(new Date());
  const n = FLOWER_POOL.length;
  // Stride co-prime with the pool size gives 4 distinct picks.
  const stride = 7;
  return [0, 1, 2, 3].map((i) => FLOWER_POOL[(seed + i * stride) % n]);
}

// Biggest rendered width per corner (the clamp() max); feeds width/height
// + sizes so next/image serves a ~240px asset instead of the 768px master.
const MAX_PX = 240;

/**
 * Global decorative floral accents in viewport corners.
 * Renders fixed-position flowers behind all page content at low opacity.
 */
export function FloralCorners({ density = 4, opacity = 0.1, excludePaths = ["/login"] }: FloralCornersProps) {
  const pathname = usePathname();

  // Login already has its own background florals.
  if (excludePaths.some((p) => pathname?.startsWith(p))) return null;

  const picks = picksForToday();

  const corners = [
    { pos: "top-0 left-0",     rot: -18, size: "clamp(110px, 18vw, 200px)" },
    { pos: "top-0 right-0",    rot: 22,  size: "clamp(120px, 20vw, 220px)" },
    { pos: "bottom-0 left-0",  rot: 12,  size: "clamp(100px, 16vw, 180px)" },
    { pos: "bottom-0 right-0", rot: -25, size: "clamp(130px, 22vw, 240px)" },
  ].slice(0, density);

  return (
    <div
      aria-hidden="true"
      // Negative z-index (-z-10) so the corner decorations sit BEHIND
      // every page card in the normal flow. CSS stacking rules promote
      // a positioned element with z-index: 0 above static-positioned
      // descendants in the normal flow — which is what was causing the
      // top-right squash blossom to bleed into the Reports cards on
      // narrow viewports. Negative z-index pushes it firmly below.
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
      style={{ filter: "saturate(0.9)" }}
    >
      {corners.map((corner, i) => {
        const flower = picks[i] ?? picks[0];
        // Flowers natively have stem at bottom + bloom at top.
        // - Top corners: flip vertically so stem points UP off-screen and
        //   bloom HANGS DOWN into the page (visible).
        // - Right corners: flip horizontally so bloom faces left (inward).
        // - Bottom corners stay un-flipped vertically (stem off bottom,
        //   bloom growing up into view).
        const isRight = corner.pos.includes("right");
        const isTop = corner.pos.includes("top");
        const scaleX = isRight ? -1 : 1;
        const scaleY = isTop ? -1 : 1;
        const transform = `scale(${scaleX}, ${scaleY}) rotate(${corner.rot}deg)`;

        const offsetMap: Record<string, React.CSSProperties> = {
          "top-0 left-0":     { top: -40, left: -40 },
          "top-0 right-0":    { top: -50, right: -50 },
          "bottom-0 left-0":  { bottom: -50, left: -40 },
          "bottom-0 right-0": { bottom: -60, right: -60 },
        };
        return (
          <Image
            key={`${flower}-${i}`}
            src={`/assets/pressfarm/flowers/${flower}.png`}
            alt=""
            width={MAX_PX}
            height={MAX_PX}
            // Decoration must never compete with the page's LCP image.
            sizes="(max-width: 640px) 130px, 22vw"
            loading="lazy"
            fetchPriority="low"
            className="absolute"
            style={{
              ...offsetMap[corner.pos],
              width: corner.size,
              height: "auto",
              opacity,
              transform,
            }}
          />
        );
      })}
    </div>
  );
}
