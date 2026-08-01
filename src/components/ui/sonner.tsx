"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";
import { useAppStore } from "@/lib/store/app-store";

/**
 * Thin wrapper around Sonner's Toaster that picks up the current theme from
 * our Zustand store (so toasts match the dark/light UI without needing the
 * `next-themes` package).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useAppStore((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
