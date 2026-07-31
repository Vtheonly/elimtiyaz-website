"use client";

/**
 * StatusPill — small color-coded badge for statuses.
 *
 * Maps to the design tokens in globals.css:
 *   success  → #3FA66E  (PAID, PRESENT, active)
 *   warning  → #C8A98C  (PENDING, partial)
 *   danger   → #C0504D  (UNPAID, ABSENT, overdue, suspended)
 *   info     → #6EC1E4  (info, neutral)
 *   muted    → slate    (draft, cancelled)
 */

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export type StatusTone = "success" | "warning" | "danger" | "info" | "muted";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-muted text-muted-foreground border-border",
};

interface Props {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function StatusPill({ tone = "muted", children, className, icon }: Props) {
  return (
    <span
      className={cn(
        "status-pill border",
        toneClasses[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Map a payment/installment status string to a (tone, translation key) pair.
 * Used by the financial view to render status pills consistently.
 */
export function paymentStatusTone(status: string): { tone: StatusTone; key: string } {
  switch (status) {
    case "paid":
      return { tone: "success", key: "finance.status.paid" };
    case "partial":
      return { tone: "info", key: "finance.status.partial" };
    case "pending":
      return { tone: "warning", key: "finance.status.pending" };
    case "unpaid":
      return { tone: "muted", key: "finance.status.unpaid" };
    case "overdue":
      return { tone: "danger", key: "finance.status.overdue" };
    case "refunded":
      return { tone: "muted", key: "finance.status.refunded" };
    default:
      return { tone: "muted", key: status };
  }
}

/**
 * Map an attendance status string to a tone. Used by the attendance view.
 */
export function attendanceStatusTone(status: string): StatusTone {
  switch (status) {
    case "present":
      return "success";
    case "absent_excused":
      return "warning";
    case "absent_unexcused":
      return "danger";
    case "late":
      return "info";
    default:
      return "muted";
  }
}
