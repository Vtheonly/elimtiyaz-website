"use client";

/**
 * global-error.tsx — Next.js App Router root error boundary.
 *
 * Catches unhandled errors that escape every other error boundary. Renders
 * a full HTML page (this file replaces the entire document) so it can't use
 * the normal layout/chrome.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // T-385: the global error page renders outside every provider, but the
  // locale store is a plain zustand store (module-level, provider-free) —
  // useT works here and falls back to the default locale (fr) safely.
  const { t, locale, dir } = useT();
  return (
    <html lang={locale} dir={dir}>
      <body
        style={{
          margin: 0,
          background: "#242526",
          color: "#EFF2F3",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            maxWidth: "28rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "9999px",
              background: "rgba(192, 80, 77, 0.15)",
              color: "#C0504D",
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
              {t("error.generic.title")}
            </h1>
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.875rem",
                color: "#9CA3AF",
              }}
            >
              {error.message || t("error.generic.message")}
              {error.digest && (
                <span style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem" }}>
                  {t("error.code")} {error.digest}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(239, 242, 243, 0.2)",
              background: "transparent",
              color: "#EFF2F3",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            <RefreshCw size={16} />
            {t("common.retry")}
          </button>
        </div>
      </body>
    </html>
  );
}
