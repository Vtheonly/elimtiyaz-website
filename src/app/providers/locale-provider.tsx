"use client";

/**
 * LocaleProvider — applies the selected locale to the document (T-385).
 *
 * Mirrors the ThemeProvider pattern: the locale persists in the Zustand
 * store (survives reloads) and this provider syncs it onto <html>:
 *
 *   - `lang` — the active language code (fr / ar / en), replacing the
 *     server-rendered static `lang="fr"` (the layout is a static export —
 *     it cannot know the client-side preference at render time).
 *   - `dir` — "rtl" for Arabic, "ltr" otherwise. Without this, the Arabic
 *     locale rendered in a left-to-right layout (the I18N-500 gap: useT
 *     returned `dir` but no consumer ever applied it to the document).
 *
 * The effect runs only after hydration (`_hydrated`) so the first paint
 * keeps the server HTML (lang="fr", ltr) and React never warns about a
 * hydration mismatch — the flip happens in the same pass as the theme
 * class application.
 */

import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { isRtl, type Locale } from "@/lib/i18n/dictionary";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useAppStore((s) => s.locale);
  const hydrated = useAppStore((s) => s._hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtl(locale as Locale) ? "rtl" : "ltr";
  }, [locale, hydrated]);

  return <>{children}</>;
}
