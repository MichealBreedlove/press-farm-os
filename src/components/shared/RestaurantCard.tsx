"use client";

import { useState } from "react";

interface RestaurantCardProps {
  name: string;
  note: string;
  logo: string;
  /** Optional restaurant website — wraps the card in an external anchor when present */
  website?: string;
}

const eyebrowFont = {
  fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif",
};

/**
 * Card for a partner restaurant in the /about page.
 * Tries to load `logo` from public/. If the file isn't present,
 * gracefully falls back to a styled wordmark.
 * If `website` is provided, the entire card is a hover-elevated anchor
 * that opens the restaurant's site in a new tab.
 */
export function RestaurantCard({ name, note, logo, website }: RestaurantCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const inner = (
    <>
      <p
        className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mb-4"
        style={eyebrowFont}
      >
        Restaurant
      </p>
      <div className="h-20 sm:h-24 flex items-center justify-center mb-4">
        {logoFailed ? (
          <h3 className="font-display text-3xl text-farm-dark">{name}</h3>
        ) : (
          <img
            src={logo}
            alt={`${name} logo`}
            className="max-h-full max-w-full object-contain"
            onError={() => setLogoFailed(true)}
          />
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-4 h-px bg-pf-master-gold/40" />
        <div className="w-1 h-1 rounded-full bg-pf-master-gold" />
        <div className="w-4 h-px bg-pf-master-gold/40" />
      </div>
      <p className="text-xs text-farm-muted mt-3">{note}</p>
      {website && (
        <p className="text-[10px] tracking-[0.18em] uppercase text-pf-master-gold/80 mt-3" style={eyebrowFont}>
          Visit site →
        </p>
      )}
    </>
  );

  const baseClasses =
    "bg-white rounded-2xl border border-pf-master-gold/15 p-8 text-center transition-all";

  if (website) {
    return (
      <a
        href={website}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} block hover:border-pf-master-gold/40 hover:shadow-md`}
      >
        {inner}
      </a>
    );
  }

  return <div className={baseClasses}>{inner}</div>;
}
