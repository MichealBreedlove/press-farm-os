"use client";

import { useState } from "react";

interface RestaurantCardProps {
  name: string;
  note: string;
  logo: string;
}

const eyebrowFont = {
  fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif",
};

/**
 * Card for a partner restaurant in the /about page.
 * Tries to load `logo` from public/. If the file isn't present (404),
 * gracefully falls back to a styled wordmark of the restaurant name.
 */
export function RestaurantCard({ name, note, logo }: RestaurantCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-pf-master-gold/15 p-8 text-center">
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
    </div>
  );
}
