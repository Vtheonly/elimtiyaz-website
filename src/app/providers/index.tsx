"use client";

/**
 * AppProviders — composes all client-side providers for the portal.
 *
 * Order matters:
 *   1. ThemeProvider  — applies dark/light class to <html>
 *   2. AuthProvider   — subscribes to Supabase auth state
 *   3. QueryProvider  — TanStack Query for server-state caching
 *
 * Children are whatever Next.js renders for the current route.
 */

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";

/**
 * T-033 (CACHE-100) — freshness safety net for the parent portal.
 *
 * Realtime subscriptions (use-realtime.ts, repaired in T-032) are the
 * PRIMARY freshness mechanism; this config guarantees the portal never
 * degrades to stale-forever when a subscription silently breaks:
 *  - `refetchOnWindowFocus: true` — stale queries refetch when the parent
 *    returns to the tab (the refetch that was disabled at first commit).
 *  - `refetchInterval: 5 min` — conservative background poll bounding the
 *    worst-case staleness well inside the 15-min freshness budget the
 *    Android staff app uses (CROSS-104 family), without hammering the DB.
 * `staleTime: 30_000` and `retry: 1` are preserved verbatim.
 */
export const queryClientDefaultOptions = {
  queries: {
    staleTime: 30_000, // 30s — portal data is mostly read-only for parents
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  },
} as const satisfies NonNullable<ConstructorParameters<typeof QueryClient>[0]>["defaultOptions"];

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: queryClientDefaultOptions,
      })
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
