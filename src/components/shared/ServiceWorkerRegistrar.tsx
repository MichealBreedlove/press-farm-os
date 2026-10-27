"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js and handles worker updates.
 *
 * When a new worker installs over an existing one (a deploy that bumped
 * CACHE_NAME), we do NOT reload immediately: the order form only persists
 * its draft on Review, so an instant reload would wipe a chef's in-progress
 * order. Instead the reload is deferred until the tab is hidden
 * (`visibilitychange` → hidden, or `pagehide`), i.e. the chef has switched
 * apps or closed the page — at which point the fresh shell takes over
 * before they come back. If they never background the tab, the next
 * navigation picks up the new worker naturally (it already claimed clients).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloadPending = false;
    function reloadWhenHidden() {
      if (!reloadPending) return;
      if (document.visibilityState === "hidden") {
        reloadPending = false;
        window.location.reload();
      }
    }
    document.addEventListener("visibilitychange", reloadWhenHidden);
    window.addEventListener("pagehide", reloadWhenHidden);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Actively probe for a newer worker on each load — iOS standalone
        // PWAs otherwise cling to whatever worker they installed with.
        registration.update().catch(() => {});

        // The controller check skips the very first install, so there's no
        // reload on a brand-new client.
        registration.addEventListener("updatefound", () => {
          const incoming = registration.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            if (incoming.state === "installed" && navigator.serviceWorker.controller) {
              reloadPending = true;
            }
          });
        });
      })
      .catch(() => {});

    return () => {
      document.removeEventListener("visibilitychange", reloadWhenHidden);
      window.removeEventListener("pagehide", reloadWhenHidden);
    };
  }, []);

  return null;
}
