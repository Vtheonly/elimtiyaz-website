"use client";

/**
 * SwUpdateBanner — shows when a new service worker version is available.
 *
 * The banner appears at the top of the viewport (below the top app bar) and
 * stays until the user clicks "Mettre à jour" or dismisses it.
 */

import { useServiceWorker } from "@/lib/hooks/use-service-worker";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export function SwUpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const { t } = useT();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-14 z-30 flex items-center justify-center gap-2 border-b border-primary/30 bg-primary/15 px-4 py-2 text-xs font-medium text-primary backdrop-blur"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      {t("sw.update.available")}
      <Button
        size="sm"
        variant="outline"
        className="ml-2 h-7 border-primary/40 text-primary hover:bg-primary/20"
        onClick={applyUpdate}
      >
        {t("sw.update.action")}
      </Button>
      <button
        onClick={applyUpdate}
        aria-label={t("common.close")}
        className="touch-target flex items-center justify-center rounded-md p-0.5 text-primary/70 hover:bg-primary/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
