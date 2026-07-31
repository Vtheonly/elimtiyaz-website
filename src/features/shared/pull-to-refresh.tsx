"use client";

/**
 * PullToRefresh — mobile gesture that triggers a refetch when the user pulls
 * down from the top of the scroll container.
 *
 * Implementation notes:
 *   - Listens to touchstart/touchmove/touchend on the wrapped element.
 *   - Only activates when the scroll container is at scrollTop === 0.
 *   - Shows a spinner that grows as the user pulls past the threshold (70px).
 *   - On release past the threshold, calls onRefresh() and shows a spinning
 *     indicator until the promise resolves.
 *   - No-ops on desktop (touch events don't fire).
 *
 * Usage:
 *   <PullToRefresh onRefresh={async () => { await refetch(); }}>
 *     <div>…content…</div>
 *   </PullToRefresh>
 *
 * To refresh ALL visible queries, pass:
 *   onRefresh={async () => qc.invalidateQueries()}
 */

import { useRef, useState, type ReactNode } from "react";
import { RefreshCw, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70;
const MAX_PULL = 100;

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    // Only track if the user starts at the top of the scroll container.
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Apply rubber-band resistance so it gets harder to pull past MAX_PULL.
    const resisted = Math.min(MAX_PULL, delta * 0.5);
    setPullDistance(resisted);
  };

  const handleTouchEnd = async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / THRESHOLD);
  const showSpinner = refreshing || pullDistance >= THRESHOLD;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn("relative", className)}
    >
      {/* Pull indicator */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 0 ? 1 : 0,
          transition: refreshing ? "none" : "height 200ms ease, opacity 200ms ease",
        }}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-card text-primary shadow-md ring-1 ring-border/60",
            showSpinner && "animate-spin"
          )}
          style={{ transform: `rotate(${progress * 360}deg)` }}
        >
          {showSpinner ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Content shifts down with the pull */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: refreshing || pullDistance === 0 ? "transform 200ms ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
