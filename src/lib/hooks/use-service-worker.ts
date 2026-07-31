"use client";

/**
 * useServiceWorker — registers the service worker and surfaces update events.
 *
 * On mount, registers `/firebase-messaging-sw.js`. When a new version is
 * detected (the SW file changes), it sets `updateAvailable` to true so the
 * UI can prompt the user to reload.
 *
 * The `skipWaiting` function tells the waiting SW to activate immediately,
 * which triggers a page reload via the controllerchange listener.
 */

import { useEffect, useState, useCallback } from "react";

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );
        setRegistered(true);

        // Listen for new service workers waiting to activate.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration?.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // A new version is installed and waiting.
              setUpdateAvailable(true);
            }
          });
        });

        // Check for updates every 60 minutes.
        setInterval(() => {
          registration?.update().catch(() => {});
        }, 60 * 60 * 1000);
      } catch (err) {
        console.warn("[sw] registration failed:", err);
      }
    };

    register();

    // Reload when the new SW takes control.
    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;
    // Tell the waiting service worker to skip waiting.
    navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" });
  }, []);

  return { registered, updateAvailable, applyUpdate };
}
