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

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s — portal data is mostly read-only for parents
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
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
