/**
 * Firebase Cloud Messaging (FCM) — client-side integration.
 *
 * Per user requirements:
 *   "Push notifications should be implemented using Firebase Cloud Messaging (FCM).
 *    Design the notification system so it can be shared across platforms where
 *    appropriate, while keeping notification logic centralized and maintainable."
 *
 * This module is intentionally defensive: if Firebase env vars are missing,
 * every function becomes a no-op so the rest of the portal keeps working.
 *
 * The actual notification payloads are produced server-side by:
 *   - Supabase Edge Functions (workflow actions)
 *   - Supabase Realtime subscriptions (in-app notifications table)
 *
 * The FCM token registered here is what allows those server-side payloads to
 * reach THIS specific browser/tab as a native push notification (even when
 * the tab is in the background).
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  isSupported,
  getToken,
  onMessage,
  type Messaging,
} from "firebase/messaging";
import { env, isFcmConfigured } from "@/lib/env";

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export { isFcmConfigured };

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFcmConfigured) return null;
  if (app) return app;
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return app;
}

/**
 * Initialise FCM, request notification permission, and return the device
 * token. The token should be persisted to the user's profile server-side so
 * the backend can target pushes to this device.
 *
 * Returns null when:
 *   - FCM is not configured (env vars missing)
 *   - The browser doesn't support messaging (e.g. Safari < 16.4)
 *   - The user denies notification permission
 *   - No service worker is registered (Vercel serves it from /public)
 */
export async function initFcm(): Promise<string | null> {
  const a = getFirebaseApp();
  if (!a) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  messaging = getMessaging(a);

  // Register the service worker that FCM needs.
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/",
      });
    } catch (err) {
      console.warn("[fcm] service worker registration failed:", err);
      return null;
    }
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    return token ?? null;
  } catch (err) {
    console.warn("[fcm] getToken failed:", err);
    return null;
  }
}

/**
 * Subscribe to foreground push notifications (when the tab is open).
 * Background notifications are handled by the service worker.
 */
export function onForegroundPush(cb: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void): () => void {
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, (payload) => {
    const n = payload.notification ?? {};
    cb({
      title: n.title ?? undefined,
      body: n.body ?? undefined,
      data: payload.data ?? {},
    });
  });
  return unsub;
}
