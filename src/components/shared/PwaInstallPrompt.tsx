"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "press-farm:pwa-install-dismissed-at";
const REPROMPT_AFTER_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Mobile PWA install prompt — shows a one-time dismissible banner near the
 * bottom of the screen for users on phones whose browser supports adding
 * the app to home screen.
 *
 * Three states:
 *   - iOS Safari (no native install API): static instructions + share-icon
 *     hint, since iOS requires manual "Add to Home Screen"
 *   - Chromium-based (Android, desktop Chrome): listens for the
 *     `beforeinstallprompt` event and surfaces a one-tap install button
 *   - Already-installed / unsupported: renders nothing
 *
 * Dismissal is sticky for 30 days via localStorage, so chefs/receivers
 * who say "no thanks" aren't pestered every visit.
 */
export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<"ios" | "android" | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running as a standalone PWA → nothing to install.
    const standaloneIos = (window.navigator as any).standalone === true;
    const standaloneOther = window.matchMedia?.("(display-mode: standalone)").matches;
    if (standaloneIos || standaloneOther) return;

    // Honor a recent dismissal — don't pester within REPROMPT_AFTER_DAYS days.
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const ms = Date.now() - parseInt(dismissedAt, 10);
      if (Number.isFinite(ms) && ms < REPROMPT_AFTER_DAYS * 86400000) return;
    }

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIos && isSafari) {
      setVariant("ios");
      // Slight delay so the banner doesn't slam in mid-page-load
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }

    // Chromium / Android: wait for the beforeinstallprompt event
    const onBefore = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVariant("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBefore as any);
    return () => window.removeEventListener("beforeinstallprompt", onBefore as any);
  }, []);

  function dismiss() {
    setVisible(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  }

  async function handleAndroidInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
    if (choice.outcome === "dismissed" && typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  }

  if (!visible || !variant) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Press Farm"
      className="fixed inset-x-2 bottom-2 sm:bottom-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50"
    >
      <div className="bg-white rounded-2xl border border-farm-dark/10 shadow-lg overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-br from-farm-green/10 to-farm-cream/40 border-b border-farm-dark/5 flex items-start gap-3">
          <img
            src="/assets/pressfarm/logo/png/pressfarm-mandala-only.png"
            alt=""
            aria-hidden="true"
            className="w-10 h-10 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">
              Press Farm
            </p>
            <p className="font-display text-sm text-farm-dark mt-0.5">
              Install for one-tap access
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-farm-muted hover:text-farm-dark"
            aria-label="Dismiss install prompt"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {variant === "ios" && (
          <div className="px-4 py-3 text-xs text-farm-dark/85 leading-relaxed">
            <p>
              In Safari, tap the share icon{" "}
              <span className="inline-flex items-center justify-center w-5 h-5 align-middle bg-farm-cream rounded mx-0.5">
                <svg className="w-3.5 h-3.5 text-farm-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </span>{" "}
              and choose <strong>Add to Home Screen</strong>.
            </p>
            <p className="text-farm-muted mt-1.5 text-[11px]">
              Opens like a regular app — no browser bar, faster loading.
            </p>
          </div>
        )}

        {variant === "android" && (
          <div className="px-4 py-3 space-y-3">
            <p className="text-xs text-farm-dark/85 leading-relaxed">
              Add Press Farm to your home screen — opens instantly, no browser bar.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="flex-1 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleAndroidInstall}
                className="flex-1 min-h-[40px] rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-dark transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
