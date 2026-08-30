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
} from "@/lib/canonical/portal-derive";
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

type TabKey = "installments" | "payments" | "ledger" | "adjustments";

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

  const [activeTab, setActiveTab] = useState<TabKey>("installments");

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
            value={formatCurrency(Math.abs(balance.unallocatedCredit))}
            tone={balance.unallocatedCredit < 0 ? "info" : "default"}
            icon={<PiggyBank className="h-5 w-5" />}
            hint={balance.unallocatedCredit < 0 ? t("finance.balance.creditHint") : t("finance.balance.noCredit")}
          />
        </div>
      )}

      {/* Tabs — real data model: tranches, payments, statement, adjustments */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-4">
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
      {adjustments.map((adj) => {
        // Ledger adjustments are signed: negative = credit in the parent's
        // favour (reduction), positive = surcharge.
        const amount = Number(adj.amount);
        const isCredit = amount < 0;
        return (
          <CardListItem
            key={adj.entry_number ?? adj.id ?? Math.random()}
            leading={
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isCredit ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                }`}
              >
                <Scale className="h-4 w-4" />
              </div>
            }
            title={`${isCredit ? "−" : "+"}${formatCurrency(Math.abs(amount))}`}
            subtitle={`${formatDate(adj.at)}${
              adj.description ? ` • ${adj.description}` : ""
            }${adj.receipt_number ? ` • ${adj.receipt_number}` : ""}`}
            trailing={
              <StatusPill tone={isCredit ? "success" : "warning"}>
                {isCredit ? t("finance.adjustment.credit") : t("finance.adjustment.debit")}
              </StatusPill>
            }
          />
        );
      })}
    </div>
  );
}
