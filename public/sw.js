/**
 * Press Farm OS — Service Worker
 *
 * Strategy: Network-first with cache fallback for pages.
 * Cache-first for static assets (images, fonts, CSS, JS).
 * Enables offline access to the chef order form.
 */

// Bump on every deploy that ships a behavioral change so the activate
// handler purges old caches.
//   v2 → drop the pre-PwaInstallPrompt-fix bundle
//   v3 → drop the pre-independent-menu-flags bundle (the form was
//        sending is_press_bar_item / show_in_regular_menu but the
//        cached items API endpoint wasn't whitelisting them, so saves
//        looked like no-ops; v3 forces clients to fetch the new
//        whitelist code)
//   v4 → installed PWAs were pinned to a pre-05-09 service worker and
//        serving a cached app shell with no width=device-width viewport,
//        so every page rendered desktop-width on iPhone. Bumping the name
//        makes iOS pick up this (network-first, viewport-correct) worker
//        on next launch; activate then purges the stale shell.
//   v5 → microgreens trays multi-select sticky bar was z-40 vs BottomNav
//        z-50 — invisible on Android. New bundle has z-[60] + raised
//        offset; bumping cache to force PWA installs to refetch.
//   v6 → cache hygiene (2026-10-27 review): precache only static,
//        non-redirecting URLs (/, /order, /history etc. all redirect, and
//        a redirected response stored under them made the offline
//        fallback throw — plus a logged-out install stored /login's HTML
//        under /order); never cache redirected / opaque responses; never
//        cache /admin/* pages; PURGE message on sign-out so a shared
//        tablet can't replay the previous account's pages offline.
const CACHE_NAME = "press-farm-v6";

// Only URLs that return 200 for everyone, logged in or not. Authenticated
// pages are picked up lazily by the fetch handler as they're visited.
const PRECACHE_URLS = [
  "/login",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// Offline fallback for navigations with no cached copy.
const OFFLINE_FALLBACK_URL = "/login";

// Install: precache the static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Don't fail install if some URLs aren't available yet
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// PURGE: sign-out handlers post { type: "PURGE" } so the next account on
// this device starts from an empty cache (see src/components/shared/sw-purge.ts).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PURGE") {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});

/**
 * Only store plain, same-origin, non-redirected 200s. A redirected response
 * (e.g. /order → /login when logged out) replayed from cache throws a
 * "redirected response used for navigation" error in the browser, and an
 * opaque / CORS response can't be inspected at all.
 */
function isCacheable(response) {
  return Boolean(response) && response.ok && !response.redirected && response.type === "basic";
}

// Fetch: network-first for pages, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, cross-origin, API calls and auth callbacks
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/items/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (isCacheable(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 408 }));
      })
    );
    return;
  }

  // Admin pages are never cached: they're large, change on every visit,
  // and an offline replay of a stale availability / orders page is worse
  // than an offline message.
  if (url.pathname.startsWith("/admin")) return;

  // Pages: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheable(response)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline fallback for navigation
          if (request.mode === "navigate") {
            return caches
              .match(OFFLINE_FALLBACK_URL)
              .then((page) => page || new Response("Offline", { status: 503 }));
          }
          return new Response("", { status: 408 });
        });
      })
  );
});
