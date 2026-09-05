"use client";

/**
 * FinancialView — parent-facing financial account.
 *
 * RESTRUCTURED (session 8, 2026-08-30) around the real backend data model
 * instead of the demo-era tab list. Live-backend evidence that drove it:
 *
 *   - `ledger_entries` is the single source of truth (INV-1) and the ONLY
 *     table holding charges AND adjustments (1,597 live rows) → the new
 *     "Relevé" statement tab replays it with a running balance.
 *   - `account_adjustments` is EMPTY in production (0 rows) while 318
 *     adjustments live in the ledger → the Adjustments tab now derives
 *     from ledger entries instead of the dead table.
 *   - `invoices` (0 rows, no writer on any platform) and `receipts`
 *     (orphaned table — CROSS-101/T-066 BLOCKED) were removed as standalone
 *     tabs: they rendered a permanent, misleading "empty" state. Receipt
 *     download stays available per-payment (it lights up the moment the
 *     backend starts generating rows).
 *
 * Per the Platform Feature Allocation Matrix, the portal can VIEW dues,
 * schedule, scans, balance, receipts and adjustments. It CANNOT make
 * payments, issue invoices, apply adjustments or refund — desktop-only.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import { useInstallments, usePayments, useLedgerEntries } from "@/lib/hooks/portal-queries";
import {
  installmentRemainingAmount,
  portalFinancialSummary,
  ledgerAdjustmentEntries,
  displayCredit,
} from "@/lib/canonical/portal-derive";
import {
  parentBillingBreakdown,
  classifyAdjustmentRows,
} from "@/lib/canonical/billing-breakdown";
import { useFinancialRealtime } from "@/lib/hooks/use-realtime";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/features/shared/kpi-card";
import {
  StatusPill,
  paymentStatusTone,
} from "@/features/shared/status-pill";
import {
  SectionHeader,
  EmptyState,
  CardListItem,
  ListSkeleton,
  KpiSkeleton,
  ErrorState,
} from "@/features/shared/state-views";
import { StudentSwitcherDropdown } from "@/features/students/student-switcher";
import { LedgerTimeline } from "@/features/financial/ledger-timeline";
import {
  Wallet,
  CalendarClock,
  Receipt,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Scale,
  BookOpenText,
  Bus,
  MoreHorizontal,
  PiggyBank,
} from "lucide-react";
import { formatCurrency, formatDate, formatFullName, daysUntil } from "@/lib/format";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PaymentRow, InstallmentRow, LedgerEntryRow } from "@/lib/types/database";
import type { ParentBillingBreakdown } from "@/lib/canonical/billing-breakdown";

type TabKey = "billing" | "installments" | "payments" | "ledger" | "adjustments";

export function FinancialView() {
  const { t } = useT();
  const { parent, children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);
  // Hoisted so the React Compiler can preserve the memoizations below.
  const parentId = parent?.id ?? null;

  // Realtime: balance updates the moment staff records a payment on desktop.
  useFinancialRealtime(parentId);

  // Tranches + payments for the active child (or the whole family when no
  // child is selected).
  const installments = useInstallments(parentId, {
    studentId: activeKid?.id ?? null,
    limit: 100,
  });
  const payments = usePayments(parentId, {
    studentId: activeKid?.id ?? null,
    limit: 50,
  });
  // Canonical balance source (INV-1): replay the parent's ledger entries —
  // the exact same computation the desktop debt dashboard, the Android
  // installment screen, and the backend compute_parent_summary RPC run.
  // NOT student-filtered: the balance is a FAMILY-level figure (the parent
  // is the account holder; children only split the charges).
  const ledgerEntries = useLedgerEntries(parentId) // T-035/WEAK-022: full ledger replay (paged) — a hard cap would corrupt the balance;

  const [activeTab, setActiveTab] = useState<TabKey>("billing");

  // Aggregate balance — CANONICAL (ledger replay, never installment sums).
  const balance = useMemo(() => {
    if (!ledgerEntries.data || !parentId) {
      return { outstanding: 0, overdue: 0, unallocatedCredit: 0, pending: 0, charged: 0, paid: 0 };
    }
    const summary = portalFinancialSummary(ledgerEntries.data, parentId);
    return {
      outstanding: summary.outstanding,
      overdue: summary.overdue,
      unallocatedCredit: summary.unallocatedCredit,
      pending: summary.totalPending,
      charged: summary.totalCharged,
      paid: summary.totalPaid,
    };
  }, [ledgerEntries.data, parentId]);

  // Adjustments derived from the ledger (the account_adjustments table is
  // empty in production — the real rows are ledger adjustment entries).
  const adjustments = useMemo(
    () => (ledgerEntries.data ? ledgerAdjustmentEntries(ledgerEntries.data) : []),
    [ledgerEntries.data]
  );

  // T-166: family-wide installments + ledger feed the itemized "Facturation"
  // breakdown (per-child charges + REAL tranche coverage). Not
  // student-filtered — the billing card shows every child of the family,
  // mirroring the desktop parent-drawer Finances tab.
  const familyInstallments = useInstallments(parentId, {
    studentId: null,
    limit: 200,
  });
  const billing = useMemo(
    () =>
      ledgerEntries.data && familyInstallments.data
        ? parentBillingBreakdown(ledgerEntries.data, familyInstallments.data, kids, {
            // T-168: adjustment-aware reconciliation — same equation as the
            // desktop drawer (gross − remises + majorations = net; net −
            // cleared − pending = reste; bridge to the server balance).
            adjustmentRows: adjustments,
            clearedPaid: Math.max(0, balance.paid - balance.pending),
            pendingPaid: balance.pending,
            serverOutstanding: balance.outstanding,
          })
        : null,
    [ledgerEntries.data, familyInstallments.data, kids, adjustments, balance],
  );

  const isRestricted = Boolean(parent?.is_financially_restricted);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
      {/* Header with student filter */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("finance.title")}</h1>
        {kids.length > 1 && <StudentSwitcherDropdown />}
      </div>

      {/* Financial restriction banner */}
      {isRestricted && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-warning">{t("finance.restrictions.title")}</p>
            <p className="mt-1 text-muted-foreground">{t("finance.restrictions.body")}</p>
          </div>
        </div>
      )}

      {/* KPI row — canonical ledger-replay values (INV-1), correctly labeled */}
      {ledgerEntries.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label={t("finance.balance.outstanding")}
            value={formatCurrency(balance.outstanding)}
            tone={balance.outstanding > 0 ? "danger" : "success"}
            icon={<Wallet className="h-5 w-5" />}
            hint={
              balance.outstanding > 0
                ? t("finance.balance.outstandingHint")
                : t("finance.balance.settled")
            }
          />
          <KpiCard
            label={t("finance.balance.overdue")}
            value={formatCurrency(balance.overdue)}
            tone={balance.overdue > 0 ? "danger" : "success"}
            icon={<AlertTriangle className="h-5 w-5" />}
            hint={balance.overdue > 0 ? t("finance.balance.overdueHint") : t("finance.balance.noOverdue")}
          />
          <KpiCard
            label={t("finance.installment.paid")}
            value={formatCurrency(balance.paid)}
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
            hint={balance.pending > 0 ? t("finance.balance.pendingHint", { amount: formatCurrency(balance.pending) }) : t("finance.balance.paidHint")}
          />
          <KpiCard
            label={t("finance.balance.credit")}
            /* T-104/ADR-010: derived credit (DATA-009) — the raw negative
               balance double-counts credit for canonical-path overpayments;
               booked unallocated credit wins, else the raw balance is used.
               Same rule as the desktop dossier card (displayParentCredit). */
            value={formatCurrency(displayCredit(balance.outstanding, balance.unallocatedCredit))}
            tone={displayCredit(balance.outstanding, balance.unallocatedCredit) > 0 ? "info" : "default"}
            icon={<PiggyBank className="h-5 w-5" />}
            hint={displayCredit(balance.outstanding, balance.unallocatedCredit) > 0 ? t("finance.balance.creditHint") : t("finance.balance.noCredit")}
          />
        </div>
      )}

      {/* Tabs — real data model: billing breakdown, tranches, payments, statement, adjustments */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="billing">{t("finance.billing")}</TabsTrigger>
          <TabsTrigger value="installments">{t("finance.installments")}</TabsTrigger>
          <TabsTrigger value="payments">{t("finance.payments")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("finance.ledger.title")}</TabsTrigger>
          <TabsTrigger value="adjustments">
            {t("finance.adjustments")}
            {adjustments.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                {adjustments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Billing — itemized per-child / per-service breakdown (T-166) */}
        <TabsContent value="billing" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t("finance.billing.intro")}</p>
          <BillingTab
            breakdown={billing}
            isLoading={ledgerEntries.isLoading || familyInstallments.isLoading}
            onRetry={() => {
              ledgerEntries.refetch();
              familyInstallments.refetch();
            }}
          />
        </TabsContent>

        {/* Tranches — the installment schedule the school issued */}
        <TabsContent value="installments" className="mt-4 space-y-3">
          {installments.isLoading ? (
            <ListSkeleton count={4} />
          ) : installments.isError ? (
            <ErrorState title={t("common.error.title")} onRetry={() => installments.refetch()} />
          ) : installments.data && installments.data.length > 0 ? (
            <div className="space-y-2">
              {installments.data.map((inst) => (
                <InstallmentRowView key={inst.id} inst={inst} kidName={activeKid ? formatFullName(activeKid) : undefined} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("finance.empty.noInstallments")}
              description={t("finance.empty.noInstallmentsBody")}
              icon={<CalendarClock className="h-6 w-6" />}
            />
          )}
        </TabsContent>

        {/* Payments — money actually collected at the counter */}
        <TabsContent value="payments" className="mt-4 space-y-3">
          {payments.isLoading ? (
            <ListSkeleton count={4} />
          ) : payments.isError ? (
            <ErrorState title={t("common.error.title")} onRetry={() => payments.refetch()} />
          ) : payments.data && payments.data.length > 0 ? (
            <div className="space-y-2">
              {payments.data.map((p) => (
                <PaymentRowItem key={p.id} payment={p} kidName={activeKid ? formatFullName(activeKid) : undefined} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("finance.empty.noPayments")}
              description={t("finance.empty.noPaymentsBody")}
              icon={<Receipt className="h-6 w-6" />}
            />
          )}
        </TabsContent>

        {/* Statement — the ledger replay (source of truth) */}
        <TabsContent value="ledger" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t("finance.ledger.intro")}</p>
          <LedgerTimeline
            entries={
              activeKid
                ? (ledgerEntries.data ?? []).filter((e) => e.student_id === activeKid.id)
                : ledgerEntries.data
            }
            isLoading={ledgerEntries.isLoading}
            isError={ledgerEntries.isError}
            onRetry={() => ledgerEntries.refetch()}
          />
        </TabsContent>

        {/* Adjustments — derived from ledger adjustment entries */}
        <TabsContent value="adjustments" className="mt-4 space-y-3">
          <AdjustmentsTab adjustments={adjustments} isLoading={ledgerEntries.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * BillingTab — T-166: the itemized "Prestations facturées" breakdown.
 *
 * Read-side only (ADR-002): charges come from ledger rows, tranche coverage
 * from REAL installment rows (no client-side waterfall/synthesis — the
 * parent sees exactly what the server's collect_and_allocate_payment
 * waterfall produced). Same numbers as the desktop drawer's Finances tab.
 */
function BillingTab({
  breakdown,
  isLoading,
  onRetry,
}: {
  breakdown: ParentBillingBreakdown | null;
  isLoading: boolean;
  onRetry: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<"by_child" | "by_service">("by_child");

  if (isLoading) {
    return <ListSkeleton count={4} />;
  }
  if (!breakdown) {
    return <ErrorState title={t("common.error.title")} onRetry={onRetry} />;
  }
  if (breakdown.totalBilled <= 0 && breakdown.byChild.every((c) => c.lineItems.length === 0)) {
    return (
      <EmptyState
        title={t("finance.billing.noCharges")}
        description={t("finance.billing.noChargesBody")}
        icon={<Receipt className="h-6 w-6" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Header: academic year + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("finance.billing.year")} {breakdown.academicYear}
        </p>
        <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("by_child")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              mode === "by_child"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpenText className="h-3 w-3" /> {t("finance.billing.perChild")}
          </button>
          <button
            type="button"
            onClick={() => setMode("by_service")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              mode === "by_service"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Scale className="h-3 w-3" /> {t("finance.billing.perService")}
          </button>
        </div>
      </div>

      {mode === "by_child" ? (
        /* Per-child cards: itemized charges + real tranche coverage */
        <div className="space-y-3">
          {breakdown.byChild.map((child) => (
            <div key={child.student.id} className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <p className="font-medium">{child.displayName}</p>
                <div className="text-right">
                  <p className="font-mono font-semibold">{formatCurrency(child.billedTotal)}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {t("finance.billing.engagedTotal")}
                  </p>
                </div>
              </div>

              {/* Itemized charges */}
              {child.lineItems.length > 0 ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("finance.billing.items")}
                  </p>
                  <ul className="divide-y divide-border/40 rounded border border-border/40 bg-muted/20 text-sm">
                    {child.lineItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <span className="font-mono">{formatCurrency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("finance.billing.noCharges")}</p>
              )}

              {/* Real tranche coverage — where the money landed */}
              {child.tranches.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("finance.billing.tranches")}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {child.tranches.map((tr) => {
                      const progress =
                        tr.amountDue > 0
                          ? Math.min(100, ((tr.amountPaid + tr.amountPending) / tr.amountDue) * 100)
                          : 0;
                      const settled = tr.status === "paid" || tr.remaining <= 0;
                      return (
                        <div
                          key={tr.installmentId}
                          className={`rounded-md border p-2.5 text-xs space-y-1.5 ${
                            settled
                              ? "border-success/40 bg-success/5"
                              : tr.amountPaid + tr.amountPending > 0
                                ? "border-warning/40 bg-warning/5"
                                : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{tr.label}</span>
                            {settled ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                            ) : (
                              <StatusPill tone={paymentStatusTone(tr.status ?? "unpaid").tone}>
                                {t(paymentStatusTone(tr.status ?? "unpaid").key)}
                              </StatusPill>
                            )}
                          </div>
                          {tr.dueDate && (
                            <p className="text-[10px] text-muted-foreground">
                              {t("finance.installment.due")} {formatDate(tr.dueDate)}
                            </p>
                          )}
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${settled ? "bg-success" : "bg-primary"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="text-success">
                              {formatCurrency(tr.amountPaid)} {t("finance.installment.paid").toLowerCase()}
                              {tr.amountPending > 0 && (
                                <span className="text-warning">
                                  {" "}• {formatCurrency(tr.amountPending)}{" "}
                                  {t("finance.installment.pending").toLowerCase()}
                                </span>
                              )}
                            </span>
                            <span className={tr.remaining > 0 ? "font-semibold text-destructive" : ""}>
                              {formatCurrency(tr.remaining)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Consolidated per-service totals — T-168: share % + child attribution */
        <div className="space-y-2">
          {breakdown.byService.map((svc) => (
            <div key={svc.category} className="rounded-md border border-border/40 bg-muted/10 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{svc.label}</p>
                  <p className="text-[10px] text-muted-foreground">{svc.count}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="block font-mono font-semibold text-primary">
                    {formatCurrency(svc.amount)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{svc.sharePct} % {t("finance.billing.share")}</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.min(100, svc.sharePct)}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {svc.childAttribution.map((a) => (
                  <span key={`${svc.category}-${a.studentId ?? "famille"}`} className="text-[10px] text-muted-foreground">
                    {a.studentName} : <strong className="font-mono text-foreground">{formatCurrency(a.amount)}</strong>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {breakdown.unattributedItems.length > 0 && (
            <div className="rounded-md border border-dashed border-border p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                {t("finance.billing.familyItems")}
              </p>
              <ul className="divide-y divide-border/40 text-sm">
                {breakdown.unattributedItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="font-mono">{formatCurrency(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Family-level block (per-child view) — keeps the list exhaustive */}
      {mode === "by_child" && breakdown.unattributedItems.length > 0 && (
        <div className="rounded-md border border-dashed border-border p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {t("finance.billing.familyItems")}
          </p>
          <ul className="divide-y divide-border/40 text-sm">
            {breakdown.unattributedItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="font-mono">{formatCurrency(item.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-right text-[10px] text-muted-foreground">
            {t("finance.billing.subtotal")} :{" "}
            <strong className="font-mono text-foreground">{formatCurrency(breakdown.unattributedTotal)}</strong>
          </p>
        </div>
      )}

      {/* T-168 — adjustment-aware reconciliation footer (full equation) */}
      <div className="space-y-1 rounded-b-lg border border-border/40 bg-muted/30 px-3 py-2.5 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("finance.billing.recon")}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("finance.billing.recon.gross")}</span>
          <span className="font-mono font-semibold">{formatCurrency(breakdown.reconciliation.grossBilled)}</span>
        </div>
        {breakdown.reconciliation.adjustmentsCredit > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("finance.billing.recon.credit")}</span>
            <span className="font-mono text-success">− {formatCurrency(breakdown.reconciliation.adjustmentsCredit)}</span>
          </div>
        )}
        {breakdown.reconciliation.adjustmentsDebit > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("finance.billing.recon.debit")}</span>
            <span className="font-mono text-destructive">+ {formatCurrency(breakdown.reconciliation.adjustmentsDebit)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("finance.billing.recon.net")}</span>
          <span className="font-mono font-semibold">{formatCurrency(breakdown.reconciliation.netDue)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("finance.billing.recon.cleared")}</span>
          <span className="font-mono text-success">− {formatCurrency(breakdown.reconciliation.clearedPaid)}</span>
        </div>
        {breakdown.reconciliation.pendingPaid > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("finance.billing.recon.pending")}</span>
            <span className="font-mono text-warning">− {formatCurrency(breakdown.reconciliation.pendingPaid)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("finance.billing.recon.remaining")}</span>
          <span className="font-mono font-bold">{formatCurrency(breakdown.reconciliation.derivedRemaining)}</span>
        </div>
        {breakdown.reconciliation.hasBridge && (
          <div className="flex items-center justify-between rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px]">
            <span className="text-warning">{t("finance.billing.recon.bridge")}</span>
            <span className="font-mono font-bold text-warning">
              {formatCurrency(breakdown.reconciliation.bridge)}
            </span>
          </div>
        )}
        {breakdown.reconciliation.serverOutstanding != null && (
          <div className="flex items-center justify-between border-t border-border/40 pt-1 text-sm">
            <span className="flex items-center gap-1 font-medium text-muted-foreground">
              {!breakdown.reconciliation.hasBridge && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {t("finance.billing.recon.server")}
            </span>
            <span
              className={`font-mono font-bold ${
                breakdown.reconciliation.serverOutstanding > 0 ? "text-destructive" : "text-success"
              }`}
            >
              {formatCurrency(breakdown.reconciliation.serverOutstanding)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Category badge shared by tranches and payments. */
function CategoryBadge({ category }: { category: string | null | undefined }) {
  const { t } = useT();
  const map: Record<string, typeof BookOpenText> = {
    tuition: BookOpenText,
    transport: Bus,
  };
  const Icon = map[category ?? ""] ?? MoreHorizontal;
  const label = t(`finance.category.${category ?? "other"}`);
  const display = label.startsWith("finance.category.") ? (category ?? "—") : label;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
      <Icon className="h-3 w-3" />
      {display}
    </span>
  );
}

function InstallmentRowView({ inst, kidName }: { inst: InstallmentRow; kidName?: string }) {
  const { t } = useT();
  // Canonical remaining (Invariant 4): due − paid − pending. Uncleared
  // check/transfer funds reduce what the parent owes without marking the
  // tranche paid — identical to the backend waterfall + Android engine.
  const remaining = installmentRemainingAmount(inst);
  const pending = Number(inst.amount_pending ?? 0);
  const days = daysUntil(inst.due_date);
  const tone = paymentStatusTone(inst.status);
  // Cleared progress; pending funds render as an in-progress overlay hint.
  const progress =
    inst.amount_due > 0
      ? Math.min(100, ((Number(inst.amount_paid) + pending) / Number(inst.amount_due)) * 100)
      : 0;
  // Real DB label (migration 0032): "Tranche 1"… with the tranche number as
  // fallback for legacy rows imported before labels existed.
  const title = inst.label?.trim() || `${t("finance.installment.tranche")} ${inst.tranche_number}`;

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{title}</p>
            <StatusPill tone={tone.tone}>{t(tone.key)}</StatusPill>
            <CategoryBadge category={inst.category} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {kidName ? `${kidName} • ` : ""}
            {t("finance.installment.due")} {formatDate(inst.due_date)}
            {inst.status !== "paid" && days >= 0 && days <= 7 && (
              <span className="ml-1 text-warning">• J-{days}</span>
            )}
            {inst.status !== "paid" && days < 0 && (
              <span className="ml-1 text-destructive">
                • {Math.abs(days)}j {t("finance.status.overdue").toLowerCase()}
              </span>
            )}
            {inst.payment_plan === "full_annual" && (
              <span className="ml-1 text-info">• {t("finance.installment.fullAnnual")}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono font-semibold">{formatCurrency(remaining)}</p>
          <p className="text-xs text-muted-foreground">{t("finance.installment.remaining")}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>
          {formatCurrency(inst.amount_paid)} {t("finance.installment.paid").toLowerCase()}
          {pending > 0 && (
            <span className="text-warning"> • {formatCurrency(pending)} {t("finance.installment.pending").toLowerCase()}</span>
          )}
        </span>
        <span>{formatCurrency(inst.amount_due)}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PaymentRowItem({ payment, kidName }: { payment: PaymentRow; kidName?: string }) {
  const { t } = useT();
  const [showProof, setShowProof] = useState(false);
  // Real payment status (was hardcoded "paid" — payments can be pending,
  // pending_clearance, refunded…).
  const tone = paymentStatusTone(payment.status);
  // payment_number IS the receipt number (kept in sync by trigger —
  // payments.receipt_number is the alias column).
  const receiptNo = payment.receipt_number ?? payment.payment_number;

  const viewProof = async () => {
    if (!payment.proof_path || !supabase) return;
    const { data, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(payment.proof_path, 300);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="rounded-lg border border-border/50 bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
          <Receipt className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-mono font-semibold">{formatCurrency(payment.amount)}</p>
            <CategoryBadge category={payment.category} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {t(`finance.payment.method.${payment.method}`)} • {formatDate(payment.collected_at)}
            {kidName ? ` • ${kidName}` : ""}
            {receiptNo ? ` • ${t("finance.payment.receipt")} ${receiptNo}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tone={tone.tone}>{t(tone.key)}</StatusPill>
        </div>
      </div>

      {/* Action row — proof/receipt appear only when the backend attached one */}
      {(payment.proof_path || payment.status === "pending_clearance" || payment.method !== "cash") && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-2">
          {payment.proof_path && (
            <Button variant="ghost" size="sm" onClick={() => setShowProof(true)}>
              <FileText className="mr-1 h-3.5 w-3.5" />
              {t("finance.payment.proof")}
            </Button>
          )}
        </div>
      )}

      {/* Payment detail dialog — check/transfer metadata from the DB row */}
      <Dialog open={showProof} onOpenChange={setShowProof}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("finance.payment.proofTitle")}</DialogTitle>
            <DialogDescription>
              {formatCurrency(payment.amount)} • {formatDate(payment.collected_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {payment.method === "check" && (
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">{t("finance.payment.checkNumber")}:</span>{" "}
                  {payment.check_number ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("finance.payment.checkBank")}:</span>{" "}
                  {payment.check_bank_name ?? "—"}
                </p>
                {payment.check_clearance_date && (
                  <p>
                    <span className="text-muted-foreground">{t("finance.payment.clearance")}:</span>{" "}
                    {formatDate(payment.check_clearance_date)}
                  </p>
                )}
              </div>
            )}
            {payment.method === "transfer" && (
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">{t("finance.payment.transferRef")}:</span>{" "}
                  {payment.transfer_reference ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("finance.payment.transferBank")}:</span>{" "}
                  {payment.transfer_source_bank ?? "—"}
                </p>
              </div>
            )}
            <Button onClick={viewProof} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {t("finance.payment.openProof")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AdjustmentsTab({
  adjustments,
  isLoading,
}: {
  adjustments: LedgerEntryRow[];
  isLoading: boolean;
}) {
  const { t } = useT();

  if (isLoading) {
    return <ListSkeleton count={4} />;
  }
  if (adjustments.length === 0) {
    return (
      <EmptyState
        title={t("finance.adjustment.empty")}
        description={t("finance.adjustment.emptyBody")}
        icon={<Scale className="h-6 w-6" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {(() => {
        // T-168: badge + reason + PROVENANCE derived by the canonical
        // derivation — same wording and the same pairing algorithm as the
        // desktop drawer and the Android terminal: Documenté = actual
        // content · Contrepassation = net-zero reversal pair · Non documenté
        // = legacy import to audit.
        const classified = classifyAdjustmentRows(adjustments);
        return classified.map((c) => {
          const isCredit = c.kind === "credit";
          const pair = c.pairedWithId
            ? classified.find((x) => x.id === c.pairedWithId)
            : null;
          return (
            <CardListItem
              key={c.id}
              leading={
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    isCredit ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}
                >
                  <Scale className="h-4 w-4" />
                </div>
              }
              title={`${isCredit ? "−" : "+"}${formatCurrency(Math.abs(c.amount))}`}
              subtitle={
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {formatDate(c.at)}
                    <ProvenancePill provenance={c.provenance} label={c.provenanceLabel} />
                    {c.receiptRef ? <span className="text-[10px] text-muted-foreground">{c.receiptRef}</span> : null}
                  </div>
                  <p className={c.isDiagnosticFallback ? "italic text-muted-foreground" : ""}>
                    {c.reasonLabel}
                  </p>
                  {/* T-168 — explicit meaning: what this entry IS and what it
                      does to the balance (content vs trap vs mistake). */}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{c.meaningLabel}</p>
                  {pair && (
                    <p className="mt-0.5 text-[10px] font-medium text-warning">
                      ↔ {formatDate(pair.at)} — {formatCurrency(Math.abs(pair.amount))}
                    </p>
                  )}
                </>
              }
              trailing={
                <StatusPill tone={isCredit ? "success" : "warning"}>
                  {c.badgeLabel}
                </StatusPill>
              }
            />
          );
        });
      })()}
    </div>
  );
}

/** T-168 — provenance pill (documented / reversal pair / undocumented). */
function ProvenancePill({
  provenance,
  label,
}: {
  provenance: "documented" | "reversal_pair" | "undocumented";
  label: string;
}) {
  const tone =
    provenance === "documented"
      ? "bg-success/10 text-success border-success/30"
      : provenance === "reversal_pair"
        ? "bg-warning/10 text-warning border-warning/40"
        : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${tone}`}>{label}</span>
  );
}
