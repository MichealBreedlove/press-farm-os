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
const CACHE_NAME = "press-farm-v5";

const PRECACHE_URLS = [
  "/",
  "/login",
  "/order",
  "/order/review",
  "/order/confirmed",
  "/history",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// Install: precache critical pages
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

// Fetch: network-first for pages, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and API calls
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/items/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 408 }));
      })
    );
    return;
  }

  // Pages: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
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
            return caches.match("/").then((root) => root || new Response("Offline", { status: 503 }));
          }
          return new Response("", { status: 408 });
        });
      })
  );
});
