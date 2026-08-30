"use client";

/**
 * LedgerTimeline — the parent's account statement.
 *
 * Renders `ledger_entries` — the system's single source of truth (INV-1) —
 * as a chronological bank-statement-style timeline grouped by month, with
 * a running balance computed by the canonical replay
 * (portal-derive.ledgerTimeline).
 *
 * WHY this view exists: the portal previously showed only installments +
 * payments, neither of which can explain the parent's balance on its own
 * (charges and adjustments live ONLY in the ledger). The statement is the
 * one place where the full business flow is visible:
 *   charge (+) → payment (−) → adjustment (±) → refund (−)
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/use-t";
import { ledgerTimeline } from "@/lib/canonical/portal-derive";
import type { LedgerEntryRow } from "@/lib/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  SectionHeader,
  EmptyState,
  ListSkeleton,
  ErrorState,
} from "@/features/shared/state-views";
import { StatusPill, type StatusTone } from "@/features/shared/status-pill";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Scale,
  Undo2,
  BookOpenText,
  Bus,
  UtensilsCrossed,
  Shirt,
  BookOpen,
  Palette,
  HeartPulse,
  MessagesSquare,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Category (billing account) badge — mirrors the payment_category enum. */
function CategoryBadge({ category }: { category: string | null | undefined }) {
  const { t } = useT();
  const map: Record<string, { icon: typeof BookOpenText; tone: StatusTone }> = {
    tuition: { icon: BookOpenText, tone: "info" },
    transport: { icon: Bus, tone: "info" },
    canteen: { icon: UtensilsCrossed, tone: "info" },
    uniform: { icon: Shirt, tone: "info" },
    books: { icon: BookOpen, tone: "info" },
    extracurricular: { icon: Palette, tone: "info" },
    therapy_psychology: { icon: HeartPulse, tone: "info" },
    therapy_speech: { icon: MessagesSquare, tone: "info" },
  };
  const conf = map[category ?? ""] ?? { icon: MoreHorizontal, tone: "muted" };
  const Icon = conf.icon;
  const label = t(`finance.category.${category ?? "other"}`);
  // Render the raw wire code when no translation exists.
  const display = label.startsWith("finance.category.") ? (category ?? "—") : label;
  return (
    <StatusPill tone={conf.tone} className="gap-1">
      <Icon className="h-3 w-3" />
      {display}
    </StatusPill>
  );
}

function entryIcon(type: string) {
  switch (type) {
    case "charge":
      return { icon: ArrowUpRight, cls: "bg-warning/10 text-warning" };
    case "payment":
      return { icon: Receipt, cls: "bg-success/10 text-success" };
    case "adjustment":
      return { icon: Scale, cls: "bg-info/10 text-info" };
    case "refund":
      return { icon: Undo2, cls: "bg-success/10 text-success" };
    case "reversal":
      return { icon: Undo2, cls: "bg-muted text-muted-foreground" };
    default:
      return { icon: ArrowDownLeft, cls: "bg-muted text-muted-foreground" };
  }
}

export function LedgerTimeline({
  entries,
  isLoading,
  isError,
  onRetry,
}: {
  entries: LedgerEntryRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}) {
  const { t } = useT();

  const timeline = useMemo(() => (entries ? ledgerTimeline(entries) : []), [entries]);

  // Group by month bucket, newest month first.
  const groups = useMemo(() => {
    const byMonth = new Map<string, typeof timeline>();
    for (const item of timeline) {
      const list = byMonth.get(item.month) ?? [];
      list.push(item);
      byMonth.set(item.month, list);
    }
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [timeline]);

  if (isLoading) return <ListSkeleton count={6} />;
  if (isError)
    return (
      <ErrorState
        title={t("common.error.title")}
        description={t("common.error.network")}
        onRetry={onRetry}
      />
    );
  if (groups.length === 0)
    return (
      <EmptyState
        title={t("finance.ledger.empty.title")}
        description={t("finance.ledger.empty.body")}
        icon={<BookOpenText className="h-6 w-6" />}
      />
    );

  return (
    <div className="space-y-5">
      {groups.map(([month, items]) => {
        // Month net (sum of signed amounts) + end-of-month running balance.
        const monthNet = items.reduce((acc, i) => acc + Number(i.entry.amount), 0);
        const endBalance = items[items.length - 1]?.runningBalance ?? 0;
        const label = formatDate(`${month}-01T00:00:00`, {
          locale: undefined,
        });
        return (
          <section key={month} className="space-y-2">
            <SectionHeader
              title={label}
              action={
                <span className="text-xs text-muted-foreground">
                  {monthNet >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(monthNet))} →{" "}
                  {t("finance.ledger.balance")} {formatCurrency(endBalance)}
                </span>
              }
            />
            <div className="space-y-1.5">
              {items
                .slice()
                .reverse()
                .map(({ entry, runningBalance }) => {
                  const { icon: Icon, cls } = entryIcon(entry.entry_type);
                  const amount = Number(entry.amount);
                  const isDebit = amount < 0;
                  return (
                    <div
                      key={entry.entry_number ?? entry.id ?? Math.random()}
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3"
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          cls
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-medium">
                            {t(`finance.ledger.type.${entry.entry_type}`)}
                          </p>
                          <CategoryBadge category={entry.category} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatDate(entry.at, { withTime: true })}
                          {entry.receipt_number ? ` • ${t("finance.payment.receipt")} ${entry.receipt_number}` : ""}
                          {entry.description ? ` • ${entry.description}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "font-mono text-sm font-semibold",
                            isDebit ? "text-success" : "text-warning"
                          )}
                        >
                          {isDebit ? "−" : "+"}
                          {formatCurrency(Math.abs(amount))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {t("finance.ledger.running")}: {formatCurrency(runningBalance)}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
