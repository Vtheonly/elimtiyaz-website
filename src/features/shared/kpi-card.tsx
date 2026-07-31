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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-1.5 font-mono text-2xl font-semibold leading-none", toneText[tone])}>
              {value}
            </p>
            {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          {icon && (
            <div className={cn("shrink-0 rounded-lg bg-muted/50 p-2", toneText[tone])}>{icon}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
