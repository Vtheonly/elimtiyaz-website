/**
 * T-033 — website freshness fallback regression suite (CACHE-100).
 *
 * Problem: the global TanStack Query config disabled refetchOnWindowFocus,
 * making realtime the ONLY freshness mechanism. When a realtime hook breaks
 * (WEAK-016 / REALTIME-100…103, repaired in T-032), data went stale forever
 * within a session.
 *
 * Fixed: refetchOnWindowFocus: true + a conservative 5-minute refetchInterval
 * — a broken realtime subscription now degrades to stale-BOUNDED data.
 *
 * Tests:
 *  1. The production config (queryClientDefaultOptions — the actual object
 *     AppProviders mounts, not a copy) enables both fallbacks and keeps
 *     staleTime/retry.
 *  2. Behavioral: with the production defaults, a stale query refetches
 *     when the document becomes visible again (the window-focus signal
 *     TanStack Query listens to).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClientDefaultOptions } from "../app/providers/index";

describe("T-033 — production query config enables the freshness fallback (CACHE-100)", () => {
  it("keeps refetchOnWindowFocus ON and a conservative refetchInterval", () => {
    expect(queryClientDefaultOptions.queries.refetchOnWindowFocus).toBe(true);
    expect(queryClientDefaultOptions.queries.refetchInterval).toBeGreaterThan(0);
    // Conservative bound: at most one background poll per 5 minutes.
    expect(queryClientDefaultOptions.queries.refetchInterval).toBeGreaterThanOrEqual(60_000);
    // Preserved from the original config.
    expect(queryClientDefaultOptions.queries.staleTime).toBe(30_000);
    expect(queryClientDefaultOptions.queries.retry).toBe(1);
  });

  it("mounts the SAME config in the QueryClient (no copy divergence)", () => {
    const qc = new QueryClient({ defaultOptions: queryClientDefaultOptions });
    const resolved = qc.getDefaultOptions().queries;
    expect(resolved.refetchOnWindowFocus).toBe(true);
    expect(resolved.refetchInterval).toBe(5 * 60 * 1000);
  });
});

describe("T-033 — stale queries refetch on window focus with the production defaults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches a stale query when the document becomes visible again", async () => {
    let fetchCount = 0;

    const qc = new QueryClient({
      defaultOptions: {
        queries: { ...queryClientDefaultOptions.queries, refetchInterval: false },
      },
    });

    function Probe() {
      const q = useQuery({
        queryKey: ["t033-probe"],
        queryFn: async () => {
          fetchCount += 1;
          return fetchCount;
        },
      });
      // Single template string → single DOM text node (testable with getByText).
      return <div>{`value:${q.data ?? ""}`}</div>;
    }

    render(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );

    // Flush the initial mount fetch. TanStack's notifyManager batches
    // subscriber notifications on a timer — under fake timers the act
    // flush must also advance the clock for the render to commit.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5);
      });
    }
    expect(fetchCount).toBe(1);
    expect(screen.getByText("value:1")).toBeDefined();

    // Within staleTime: returning to the tab does NOT refetch.
    await act(async () => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchCount).toBe(1);

    // Advance past staleTime (30s) so the query becomes stale…
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    // …then return to the tab: refetchOnWindowFocus must trigger a refetch.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        // The refocus signal TanStack Query's focusManager listens for
        // (this version registers "visibilitychange" on window).
        window.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(5);
      });
    }
    expect(fetchCount).toBe(2);
    expect(screen.getByText("value:2")).toBeDefined();
  });
});
