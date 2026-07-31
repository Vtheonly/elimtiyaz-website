"use client";

/**
 * PwaInstallPrompt — shows an "Add to Home Screen" banner when the browser
 * fires the `beforeinstallprompt` event.
 *
 * The banner is dismissed for 7 days after the user clicks "Not now" so it
 * doesn't become annoying.
 *
 * Per the design system, the banner appears at the bottom (above the bottom
 * nav on mobile) and uses the brand colors.
 */

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "el-imtiyaz-pwa-install-dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed or recently dismissed.
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-md px-4 lg:bottom-4">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-lg ring-1 ring-primary/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Installer le portail</p>
          <p className="truncate text-xs text-muted-foreground">
            Accédez plus rapidement depuis votre écran d'accueil
          </p>
        </div>
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          <Download className="mr-1 h-3.5 w-3.5" />
          Installer
        </Button>
        <button
          onClick={handleDismiss}
          aria-label="Plus tard"
          className="touch-target flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
