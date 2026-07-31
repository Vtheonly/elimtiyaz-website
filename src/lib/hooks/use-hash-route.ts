"use client";

/**
 * useHashRoute — sync the active view with the URL hash.
 *
 * Maps the SPA view switcher to URLs like `#/finance`, `#/academic`, etc.
 * so users can:
 *   - Bookmark a specific view
 *   - Use the browser back/forward buttons
 *   - Share a link to a specific view
 *
 * Implementation:
 *   - ONE effect subscribes to `hashchange` and updates the store when the
 *     hash changes (back/forward button).
 *   - A SECOND effect pushes a new history entry when the store's activeView
 *     changes (nav click).
 *
 * To avoid an infinite loop (hashchange → setActiveView → pushState →
 * hashchange → …), the second effect only pushes if the hash doesn't already
 * match. The first effect's `apply()` also checks `fromHash !== activeView`
 * before calling setActiveView, so a no-op hashchange won't trigger a state
 * update.
 */

import { useEffect } from "react";
import { useAppStore, type AppView } from "@/lib/store/app-store";

const validViews: AppView[] = [
  "home",
  "academic",
  "finance",
  "attendance",
  "homework",
  "calendar",
  "messages",
  "notifications",
  "profile",
];

function parseHash(): AppView | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace(/^#\/?/, "").trim() as AppView;
  return validViews.includes(h) ? h : null;
}

function viewToHash(view: AppView): string {
  return `#/${view}`;
}

export function useHashRoute() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  // 1. On hashchange (back/forward), update the store.
  //    We read the current activeView from the store inside the effect's
  //    closure, so the listener always has the latest value without needing
  //    to re-subscribe.
  useEffect(() => {
    const apply = () => {
      const fromHash = parseHash();
      const current = useAppStore.getState().activeView;
      if (fromHash && fromHash !== current) {
        setActiveView(fromHash);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [setActiveView]);

  // 2. When the store's activeView changes (nav click), push the hash.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const expected = viewToHash(activeView);
    if (window.location.hash !== expected) {
      const url = `${window.location.pathname}${window.location.search}${expected}`;
      window.history.pushState(null, "", url);
    }
  }, [activeView]);
}
