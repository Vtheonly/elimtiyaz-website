/**
 * Global app store — client-side UI state.
 *
 * Holds:
 *   - activeView: which "tab" the user is on (mobile-first SPA routing)
 *   - activeStudentId: which child is currently selected (1 parent → N students)
 *   - locale: UI language
 *   - theme: dark / light
 *
 * Auth/session state lives in the AuthProvider (React context) because it
 * must subscribe to Supabase's onAuthStateChange. Persisted user preferences
 * (locale, theme, lastView) live here so they survive page reloads.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Locale } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n/dictionary";

export type AppView =
  | "home"
  | "academic"
  | "finance"
  | "attendance"
  | "homework"
  | "calendar"
  | "messages"
  | "notifications"
  | "profile";

export type ThemeMode = "dark" | "light";

interface AppState {
  // Navigation
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  // Active student (for parents with N children)
  activeStudentId: string | null;
  setActiveStudentId: (id: string | null) => void;

  // Locale & theme
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;

  // Hydration flag
  _hydrated: boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: "home",
      setActiveView: (view) => set({ activeView: view }),

      activeStudentId: null,
      setActiveStudentId: (id) => set({ activeStudentId: id }),

      locale: DEFAULT_LOCALE,
      setLocale: (l) => set({ locale: l }),

      theme: "dark",
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      _hydrated: false,
    }),
    {
      name: "el-imtiyaz-portal-prefs",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activeView: s.activeView,
        activeStudentId: s.activeStudentId,
        locale: s.locale,
        theme: s.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state._hydrated = true;
      },
    }
  )
);
