/**
 * El-Imtiyaz Portal — Service Worker
 *
 * Handles:
 *   1. Firebase Cloud Messaging background push notifications
 *   2. Offline caching (stale-while-revalidate for app shell)
 *   3. Offline fallback page when the network is down
 *
 * This file is served from /public so it's available at the root scope
 * (required for both FCM and offline caching).
 *
 * Cache strategy:
 *   - App shell (HTML, JS, CSS, fonts): stale-while-revalidate
 *   - Images: cache-first with a 24h TTL
 *   - API requests: network-first, fall back to cache
 *   - Navigation requests: network-first, fall back to cached shell, then
 *     the offline page if both fail.
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `el-imtiyaz-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `el-imtiyaz-images-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Assets to precache on install (the app shell).
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/icon.svg",
  "/manifest.webmanifest",
];

/* -------------------------------------------------------------------------- */
/* Install — precache the app shell                                           */
/* -------------------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[sw] precache failed:", err))
  );
});

/* -------------------------------------------------------------------------- */
/* Activate — clean up old caches + claim clients                             */
/* -------------------------------------------------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* -------------------------------------------------------------------------- */
/* Fetch — routing strategy                                                   */
/* -------------------------------------------------------------------------- */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin requests (Supabase, Firebase, Google Fonts) — they
  // have their own CORS/caching and we don't want to cache them here.
  if (url.origin !== self.location.origin) return;

  // Skip the service worker itself.
  if (url.pathname === "/firebase-messaging-sw.js") return;

  // Navigation requests → network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Image requests → cache-first with TTL.
  if (request.destination === "image") {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  // Static assets (JS, CSS, fonts) → stale-while-revalidate.
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else → try network, fall back to cache.
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || Response.error()))
  );
});

/* -------------------------------------------------------------------------- */
/* Strategies                                                                 */
/* -------------------------------------------------------------------------- */

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Cache the latest version of the page.
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    // Network failed — try the cache.
    const cached = await caches.match(request);
    if (cached) return cached;
    // Not in cache — show the offline page.
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response("Offline", { status: 503 });
  }
}

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Check TTL (24h).
    const cachedTime = new Date(cached.headers.get("date") || 0).getTime();
    if (Date.now() - cachedTime < 24 * 60 * 60 * 1000) {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || fetchPromise;
}

/* -------------------------------------------------------------------------- */
/* Push notifications (FCM background)                                        */
/* -------------------------------------------------------------------------- */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { title: "El-Imtiyaz", body: event.data?.text() ?? "" } };
  }

  const n = payload.notification ?? {};
  const data = payload.data ?? {};
  const title = n.title ?? "El-Imtiyaz";
  const options = {
    body: n.body ?? "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag ?? "el-imtiyaz-notification",
    data,
    requireInteraction: data.priority === "urgent",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* -------------------------------------------------------------------------- */
/* Notification click — focus existing tab or open a new one                  */
/* -------------------------------------------------------------------------- */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate?.(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});

/* -------------------------------------------------------------------------- */
/* Message from the page — used to trigger skipWaiting on update             */
/* -------------------------------------------------------------------------- */

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
