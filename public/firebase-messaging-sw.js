/**
 * El-Imtiyaz Portal — Service Worker
 *
 * Handles:
 *   1. Firebase Cloud Messaging background push notifications
 *   2. Offline caching (stale-while-revalidate for app shell)
 *   3. Offline fallback page when the network is down
 *   4. Notification click (deep-link + focus-or-open)
 *   5. Notification action buttons (Mark read / Open / Dismiss)
 *   6. pushsubscriptionchange — refreshes FCM tokens via the page
 *   7. Background sync retry for queued chat messages
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

const CACHE_VERSION = "v2-portal";
const STATIC_CACHE = `el-imtiyaz-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `el-imtiyaz-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `el-imtiyaz-images-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Assets to precache on install (the app shell).
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
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
            .filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE && key !== RUNTIME_CACHE)
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
    // Cache the latest version of the page (respecting no-store).
    if (response.ok && response.status !== 206) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
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
  } catch {
    if (cached) return cached;
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok && response.status !== 206) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || fetchPromise;
}

/* -------------------------------------------------------------------------- */
/* Push notifications (FCM background)                                        */
/* -------------------------------------------------------------------------- */

// Map a notification's `link_entity_type` to a deep-link URL hash.
// Mirrors the linkEntityTypeToView function in notifications-view.tsx so
// clicking a notification in the OS notification shade opens the same view
// the user would land on if they clicked it in-app.
function linkEntityToHash(linkEntityType) {
  const map = {
    payment: "#/finance",
    installment: "#/finance",
    invoice: "#/finance",
    receipt: "#/finance",
    expense_ticket: "#/finance",
    attendance_record: "#/attendance",
    student_document: "#/attendance",
    chat_message: "#/messages",
    chat_channel: "#/messages",
    calendar_event: "#/calendar",
    grade: "#/academic",
    homework_assignment: "#/homework",
    academic_history: "#/academic",
    parent: "#/profile",
    user_profile: "#/profile",
    account_approval_request: "#/profile",
  };
  return map[linkEntityType] ?? "#/notifications";
}

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

  // Build the deep-link URL from the notification's link_entity_type.
  // If the notification has an explicit `data.url`, prefer that.
  const targetUrl = data.url ?? linkEntityToHash(data.link_entity_type);

  // Action buttons: only show for non-urgent notifications so urgent ones
  // can use requireInteraction (the user reads then dismisses manually).
  const isUrgent = data.priority === "urgent";
  const actions = isUrgent
    ? []
    : [
        { action: "open", title: "Ouvrir" },
        { action: "dismiss", title: "Ignorer" },
      ];

  const options = {
    body: n.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag ?? `el-imtiyaz-${data.link_entity_type ?? "notification"}`,
    data: { ...data, url: targetUrl },
    requireInteraction: isUrgent,
    actions,
    // vibrate on Android (ignored on iOS).
    vibrate: isUrgent ? [200, 100, 200] : [60],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* -------------------------------------------------------------------------- */
/* Notification click — focus existing tab or open a new one                  */
/* -------------------------------------------------------------------------- */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Handle the action buttons.
  if (event.action === "dismiss") {
    return; // just close the notification
  }

  // Default action OR "open" — focus/open the portal at the deep-link URL.
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Prefer a client already at the target URL; otherwise navigate one
      // already open; otherwise open a new window.
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

/* -------------------------------------------------------------------------- */
/* pushsubscriptionchange — refresh stale FCM tokens                          */
/* -------------------------------------------------------------------------- */

self.addEventListener("pushsubscriptionchange", (event) => {
  // FCM has refreshed the token (rare but happens). We need to:
  //   1. Notify every open page so it can re-call initFcm() and re-register
  //      the new token in the device_tokens table.
  //   2. Optionally, if the page is closed, attempt the unsubscription +
  //      re-subscription here in the SW and post a message to the page.
  event.waitUntil(
    (async () => {
      try {
        // Notify every controlled client to refresh its FCM registration.
        const clientList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          client.postMessage({
            type: "FCM_TOKEN_REFRESH",
            oldEndpoint: event?.oldSubscription?.endpoint,
            newEndpoint: event?.newSubscription?.endpoint,
          });
        }
        // If no clients are open, there's nothing we can do server-side
        // (we don't have the user's auth token here). The next time the
        // user opens the portal, the page will detect the stale token via
        // initFcm() and re-register it.
      } catch (err) {
        console.warn("[sw] pushsubscriptionchange failed:", err);
      }
    })()
  );
});

/* -------------------------------------------------------------------------- */
/* Background sync — retry failed chat message sends                          */
/* -------------------------------------------------------------------------- */

self.addEventListener("sync", (event) => {
  if (event.tag === "chat-message-retry") {
    event.waitUntil(retryQueuedChatMessages());
  }
});

async function retryQueuedChatMessages() {
  // The page stores failed chat message sends in IndexedDB under the
  // "pending-chat-messages" key. We retry them here when the network is
  // restored. The actual send needs the user's session, so we just notify
  // every open client — the page has the auth context to perform the
  // INSERT. If no client is open, the retry will happen on next launch.
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clientList) {
    client.postMessage({ type: "RETRY_QUEUED_CHAT_MESSAGES" });
  }
}

/* -------------------------------------------------------------------------- */
/* Message from the page — used to trigger skipWaiting on update             */
/* -------------------------------------------------------------------------- */

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
