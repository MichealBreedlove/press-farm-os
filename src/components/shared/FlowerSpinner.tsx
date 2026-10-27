"use client";

import Image from "next/image";

// Only stem-less flowers — they read cleaner when rotating since
// there's no off-axis weight from a stem flopping around.
const SPINNER_FLOWERS = [
  "borage-2",
  "chamomile-2",
  "chive-blossom-2",
  "chive-blossom-3",
  "gem-marigold-2",
  "marigold-2",
  "nasturtium-2",
  "pansy-2",
  "buttercup",
  "california-poppy",
  "allium",
];

interface FlowerSpinnerProps {
  size?: number;
  label?: string;
}

/**
 * Pick the flower deterministically from the UTC day of year. `loading.tsx`
 * renders this on the server, so a Math.random() pick hydrated with a
 * different flower than the SSR markup (hydration mismatch warning on every
 * suspense fallback). A date seed is identical on server and client (bar
 * the midnight-UTC instant), rotates daily, and means one spinner PNG a
 * day is fetched instead of a new random one per load.
 */
function flowerForNow(): string {
  const d = new Date();
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = Math.floor((today - start) / 86400000);
  return SPINNER_FLOWERS[day % SPINNER_FLOWERS.length];
}

/**
 * Branded loading indicator — rotates a gently-spinning flower illustration
 * from the stem-less subset of the flower system.
 */
export function FlowerSpinner({ size = 64, label = "Loading…" }: FlowerSpinnerProps) {
  const flower = flowerForNow();

  return (
    <div className="text-center space-y-3" role="status" aria-live="polite">
      <div
        className="mx-auto pf-flower-spinner"
        style={{ width: size, height: size }}
      >
        <Image
          src={`/assets/pressfarm/flowers/${flower}.png`}
          alt=""
          aria-hidden="true"
          width={size * 2}
          height={size * 2}
          sizes={`${size}px`}
          className="w-full h-full object-contain"
        />
      </div>
      {label && <p className="text-sm text-farm-muted">{label}</p>}
    </div>
  );
}
