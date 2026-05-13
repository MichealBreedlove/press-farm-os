"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Bump TOUR_VERSION whenever STEPS change in a way that returning chefs should
// see again. Increment the integer — STORAGE_KEY derives from it, so every
// chef's "seen" flag is namespaced and the new tour pops up exactly once.
const TOUR_VERSION = 1;
const STORAGE_KEY = `pressfarm_onboarding_seen_v${TOUR_VERSION}`;

const STEPS = [
  {
    title: "Welcome to Press Farm 🌿",
    body: "Order fresh produce direct from Press Farm. Here's how it works in 4 quick steps.",
  },
  {
    title: "1. Search or scroll",
    body: "Use the search bar at the top to find items quickly, or scroll through categories. Each item shows what's available for this delivery.",
  },
  {
    title: "2. Pick quantities",
    body: "Tap + to add items. For items with sizes, tap the size button to expand and choose. Add a note if you have a special request.",
  },
  {
    title: "3. Review & submit",
    body: "Tap Review Order at the bottom, double-check, and submit. You can edit until ordering closes for that delivery date.",
  },
  {
    title: "4. Watch your inbox",
    body: "You'll get an email when availability is published, when your order is fulfilled, and if anything was short. That's it!",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Legacy unversioned key — treat as "seen v1" so the refactor doesn't
    // re-trigger the tour for chefs who already dismissed it. Drop this
    // fallback once we bump to TOUR_VERSION 2+.
    const seen =
      localStorage.getItem(STORAGE_KEY) ||
      (TOUR_VERSION === 1 && localStorage.getItem("pressfarm_onboarding_seen"));
    if (!seen) {
      // Brief delay so the page renders first
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function close() {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else close();
  }

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-farm-dark">{current.title}</h2>
          <button
            onClick={close}
            className="text-farm-muted hover:text-farm-muted/90 min-h-[36px] min-w-[36px] flex items-center justify-center -mr-2 -mt-2"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-farm-muted/90 leading-relaxed">{current.body}</p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === step ? "bg-farm-green" : i < step ? "bg-farm-green/40" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 mt-5">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-ghost flex-1 text-sm"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            className="btn-primary flex-[2] text-sm"
          >
            {isLast ? "Got it" : `Next (${step + 1}/${STEPS.length})`}
          </button>
        </div>

        {!isLast && (
          <button
            onClick={close}
            className="block w-full text-center text-xs text-farm-muted hover:text-farm-muted/90 mt-3 min-h-[32px]"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
