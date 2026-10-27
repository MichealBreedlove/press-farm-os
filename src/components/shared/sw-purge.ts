/**
 * Ask the active service worker to drop its page cache.
 *
 * Call this from every sign-out path BEFORE navigating to /login. Without
 * it, on a shared kitchen tablet an offline navigation after sign-out could
 * replay the previous account's cached /order or /history from sw.js.
 * Guarded — a page with no controlling worker (first visit, private mode,
 * desktop without SW) is a no-op.
 */
export function purgeServiceWorkerCache(): void {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.controller?.postMessage({ type: "PURGE" });
  } catch {
    // Never let cache housekeeping block a sign-out.
  }
}
