"use client";

/**
 * ThemeProvider — applies the `dark` / `light` class to <html>.
 *
 * We intentionally do NOT use next-themes here because the design system is
 * dark-first and the portal persists the user's choice in the Zustand store
 * (which already survives reloads). Keeping this self-contained avoids an
 * extra dependency and a potential hydration flash.
 */

import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store/app-store";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  const hydrated = useAppStore((s) => s._hydrated);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme, hydrated]);

  return <>{children}</>;
}
