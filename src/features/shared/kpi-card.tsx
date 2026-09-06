"use client";

/**
 * KpiCard — small card showing a label + big number + optional hint + icon.
 * Used on the dashboard and inside per-child summaries.
 */

import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
}

const toneText: Record<Tone, string> = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

export function KpiCard({ label, value, hint, icon, tone = "default", onClick }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "card-hover relative overflow-hidden border-border/60 bg-card",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* T-200/UI-301: mobile KPI ergonomics.
            - The decorative icon block is hidden below sm — it consumed
              ~48px of the value's column on half-width mobile cards.
            - The value steps down one size below sm and gains
              `break-words`: Intl fr-XX currency output groups digits with
              U+202F NARROW NO-BREAK SPACE, so amounts like
              "175 000,00 DA" are a single unbreakable token that
              previously poked out of the card (108px document overflow on
              the finance view at 375px) and even clipped at desktop
              4-col width for large values. The formatter itself is
              parity-pinned (format.test.ts + cross-platform corpus) and
              is deliberately NOT changed — this is display-layer only. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p
              className={cn(
                "mt-1.5 break-words font-mono text-xl font-semibold leading-none sm:text-2xl",
                toneText[tone]
              )}
            >
              {value}
            </p>
            {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          {icon && (
            <div
              className={cn(
                "hidden shrink-0 rounded-lg bg-muted/50 p-2 sm:block",
                toneText[tone]
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
