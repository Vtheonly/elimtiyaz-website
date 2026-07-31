"use client";

/**
 * OfflineIndicator — sticky banner shown when the browser loses connectivity.
 *
 * Appears at the top of the viewport (below the top app bar) whenever
 * `navigator.onLine` is false. Disappears automatically when connectivity
 * returns.
 *
 * Also invalidates all TanStack Query caches on reconnect so stale data is
 * refreshed immediately.
 */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, RefreshCw } from "lucide-react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    const update = () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (isOnline) {
        // Just came back online — invalidate everything so we refetch.
        qc.invalidateQueries();
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // Initial check (in case we mounted while offline).
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [qc]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-14 z-30 flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/15 px-4 py-2 text-xs font-medium text-warning backdrop-blur"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Vous êtes hors ligne. Les données affichées peuvent être obsolètes.
      <RefreshCw className="h-3 w-3 animate-pulse" />
    </div>
  );
}
