"use client";

import { useEffect, useState } from "react";

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

/**
 * Global decorative floral accents in viewport corners.
 * Renders fixed-position flowers behind all page content at low opacity.
 * Picks species at random per mount so different sessions feel fresh.
 */
export function FloralCorners({ density = 4, opacity = 0.1, excludePaths = ["/login"] }: FloralCornersProps) {
  const [picks, setPicks] = useState<string[] | null>(null);

  useEffect(() => {
    // Pick 4 distinct flowers — one per corner — once per mount
    const shuffled = [...FLOWER_POOL].sort(() => Math.random() - 0.5);
    setPicks(shuffled.slice(0, 4));
  }, []);

  // Skip during SSR + on excluded paths (login already has its own background florals)
  if (typeof window !== "undefined" && excludePaths.some((p) => window.location.pathname.startsWith(p))) {
    return null;
  }

  if (!picks) return null;

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
          <img
            key={`${flower}-${i}`}
            src={`/assets/pressfarm/flowers/${flower}.png`}
            alt=""
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
