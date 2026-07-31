"use client";

/**
 * useT — translation hook bound to the persisted locale.
 *
 * Usage:
 *   const t = useT();
 *   <h1>{t("auth.signin.title")}</h1>
 *
 * The hook also returns `locale` and `dir` so components can flip their
 * layout for Arabic (RTL).
 */

import { useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { translate, isRtl, type Locale } from "@/lib/i18n/dictionary";

export function useT() {
  const locale = useAppStore((s) => s.locale);

  return useMemo(() => {
    const t = (key: string, params?: Record<string, string | number>) =>
      translate(locale as Locale, key, params);
    return {
      t,
      locale: locale as Locale,
      dir: isRtl(locale as Locale) ? "rtl" : ("ltr" as "rtl" | "ltr"),
      isRtl: isRtl(locale as Locale),
    };
  }, [locale]);
}
