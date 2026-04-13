/**
 * Press Farm OS — Service Worker
 *
 * Strategy: Network-first with cache fallback for pages.
 * Cache-first for static assets (images, fonts, CSS, JS).
 * Enables offline access to the chef order form.
 */

const CACHE_NAME = "press-farm-v1";

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
