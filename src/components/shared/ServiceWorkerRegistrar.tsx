"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Actively probe for a newer worker on each load — iOS standalone
        // PWAs otherwise cling to whatever worker they installed with.
        registration.update().catch(() => {});

        // When a new worker finishes installing AND an old one was already
        // controlling this page, reload once so the fresh (cache-purged,
        // viewport-correct) shell takes over instead of the stale one. The
        // controller check skips the very first install, so there's no
        // reload loop on a brand-new client.
        registration.addEventListener("updatefound", () => {
          const incoming = registration.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            if (incoming.state === "installed" && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
