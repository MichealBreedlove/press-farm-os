"use client";

import { useEffect, useState } from "react";

const SPINNER_FLOWERS = [
  "alyssum", "anise-hyssop", "bachelor-button", "borage", "calendula",
  "chamomile", "chervil", "chive-blossom", "dill", "fairy-vetch",
  "fava-flower", "fennel", "garlic-chive", "gem-marigold",
  "lavender", "marigold", "mustard-flower", "nasturtium",
  "pansy", "pea-flower", "rosemary", "squash-blossom",
  "thai-basil", "thyme", "viola",
];

interface FlowerSpinnerProps {
  size?: number;
  label?: string;
}

/**
 * Branded loading indicator — rotates a gently-spinning flower illustration
 * picked at random from the 28-flower system.
 */
export function FlowerSpinner({ size = 64, label = "Loading…" }: FlowerSpinnerProps) {
  // Pick once on mount so it doesn't churn during a long load
  const [flower] = useState(() => SPINNER_FLOWERS[Math.floor(Math.random() * SPINNER_FLOWERS.length)]);

  return (
    <div className="text-center space-y-3">
      <div
        className="mx-auto"
        style={{
          width: size,
          height: size,
          animation: "pf-flower-spin 2.4s linear infinite",
        }}
      >
        <img
          src={`/assets/pressfarm/flowers/${flower}.png`}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-contain"
        />
      </div>
      {label && <p className="text-sm text-gray-400">{label}</p>}
      <style>{`
        @keyframes pf-flower-spin {
          0%   { transform: rotate(0deg)   scale(1); }
          50%  { transform: rotate(180deg) scale(1.06); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
