"use client";

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import {
  useInstallments,
  usePayments,
  useLedgerEntries,
  usePaymentAllocations,
  usePricingCatalog,
  useClassesByIds,
} from "@/lib/hooks/portal-queries";
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
import { paymentCoverageLines } from "@/lib/canonical/payment-coverage";
import {
  servicePricingProfiles,
  pricingCatalogFromRows,
  type ServicePricingProfile,
} from "@/lib/canonical/service-pricing-profile";
import { ServicePricingCard } from "@/features/financial/service-pricing-card";
import { useFinancialRealtime } from "@/lib/hooks/use-realtime";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/features/shared/kpi-card";
import { StatusPill, paymentStatusTone } from "@/features/shared/status-pill";
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
  PieChart,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatFullName,
  daysUntil,
} from "@/lib/format";
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
import { downloadPaymentReceiptPdf } from "@/lib/pdf/payment-receipt";
import { downloadAccountStatementPdf } from "@/lib/pdf/account-statement";
import type { ReceiptParentInfo } from "@/lib/pdf/payment-receipt";
import { formatParentName } from "@/lib/format";
import type {
  PaymentRow,
  InstallmentRow,
  LedgerEntryRow,
} from "@/lib/types/database";
import type { ParentBillingBreakdown } from "@/lib/canonical/billing-breakdown";
import { cn } from "@/lib/utils";

type TabKey =
  | "billing"
  | "installments"
  | "payments"
  | "ledger"
  | "adjustments";

export function FinancialView() {
  const { t } = useT();
  const { parent, children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);
  const parentId = parent?.id ?? null;

  useFinancialRealtime(parentId);

  const installments = useInstallments(parentId, {
    studentId: activeKid?.id ?? null,
    limit: 100,
  });
  const payments = usePayments(parentId, {
    studentId: activeKid?.id ?? null,
    limit: 50,
  });
  const ledgerEntries = useLedgerEntries(parentId);

  const [activeTab, setActiveTab] = useState<TabKey>("billing");

  const balance = useMemo(() => {
    if (!ledgerEntries.data || !parentId) {
      return {
        outstanding: 0,
        overdue: 0,
        unallocatedCredit: 0,
        pending: 0,
        charged: 0,
        paid: 0,
      };
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

  const adjustments = useMemo(
    () =>
      ledgerEntries.data ? ledgerAdjustmentEntries(ledgerEntries.data) : [],
    [ledgerEntries.data],
  );

  const familyInstallments = useInstallments(parentId, {
    studentId: null,
    limit: 200,
  });
  const billing = useMemo(
    () =>
      ledgerEntries.data && familyInstallments.data
        ? parentBillingBreakdown(
            ledgerEntries.data,
            familyInstallments.data,
            kids,
            {
              adjustmentRows: adjustments,
              clearedPaid: Math.max(0, balance.paid - balance.pending),
              pendingPaid: balance.pending,
              serverOutstanding: balance.outstanding,
            },
          )
        : null,
    [ledgerEntries.data, familyInstallments.data, kids, adjustments, balance],
  );

  const isRestricted = Boolean(parent?.is_financially_restricted);

  /* T-333 (DATA-016): the exhaustive per-service pricing profiles — derived
   * from the SAME ledger + installment rows as `billing`, plus the pricing
   * catalog (parent-readable under 0019 tenant-scoped SELECT) and the class
   * labels. Pure derivation; the card only renders. */
  const pricingCatalog = usePricingCatalog();
  const classesMap = useClassesByIds(
    kids.map((k) => k.class_id).filter((id): id is string => id != null),
  );
  const serviceProfiles = useMemo(() => {
    if (!ledgerEntries.data || !familyInstallments.data || !pricingCatalog.data) return null;
    const catalog = pricingCatalogFromRows(
      pricingCatalog.data.config,
      pricingCatalog.data.tuitionRows,
      pricingCatalog.data.gradeInfoByLevelId,
      pricingCatalog.data.transportRows,
      pricingCatalog.data.discountRows,
      pricingCatalog.data.additionalRows,
      pricingCatalog.data.complementaryRows,
      pricingCatalog.data.academicYearLabel,
    );
    return servicePricingProfiles({
      ledgerRows: ledgerEntries.data,
      installmentRows: familyInstallments.data,
      kids,
      catalog,
      classLabels: classesMap.data ?? new Map<string, string>(),
      fallbackAcademicYear: billing?.academicYear,
    });
  }, [ledgerEntries.data, familyInstallments.data, kids, pricingCatalog.data, classesMap.data, billing?.academicYear]);

  const parentInfo: ReceiptParentInfo | null = parent
    ? {
        fullName: formatParentName(parent),
        code: parent.parent_code,
        phone: parent.primary_phone,
      }
    : null;

  const STATEMENT_PAYMENTS_LIMIT = 200;
  const familyPayments = usePayments(parentId, {
    studentId: null,
    limit: STATEMENT_PAYMENTS_LIMIT,
  });
  const [statementBusy, setStatementBusy] = useState(false);
  const downloadStatement = async () => {
    if (!parentInfo || !familyPayments.data) return;
    setStatementBusy(true);
    try {
      await downloadAccountStatementPdf(
        parentInfo,
        familyPayments.data,
        {
          totalDue: balance.charged - balance.unallocatedCredit,
          totalPaid: balance.paid,
          balance: balance.outstanding,
        },
        { academicYear: null },
      );
    } catch (e) {
      toast.error(t("common.error"));
    } finally {
      setStatementBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="min-w-0 text-xl font-semibold">{t("finance.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {parentInfo && (familyPayments.data?.length ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadStatement()}
              disabled={statementBusy}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {t("finance.statement.generate")}
            </Button>
          )}
          {kids.length > 1 && <StudentSwitcherDropdown />}
        </div>
      </div>

      {isRestricted && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-warning">
              {t("finance.restrictions.title")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("finance.restrictions.body")}
            </p>
          </div>
        </div>
      )}

      {/* KPI row - Responsive desktop grid (lg:grid-cols-4) */}
      {ledgerEntries.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
            hint={
              balance.overdue > 0
                ? t("finance.balance.overdueHint")
                : t("finance.balance.noOverdue")
            }
          />
          <KpiCard
            label={t("finance.installment.paid")}
            value={formatCurrency(balance.paid)}
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
            hint={
              balance.pending > 0
                ? t("finance.balance.pendingHint", {
                    amount: formatCurrency(balance.pending),
                  })
                : t("finance.balance.paidHint")
            }
          />
          <KpiCard
            label={t("finance.balance.credit")}
            value={formatCurrency(
              displayCredit(balance.outstanding, balance.unallocatedCredit),
            )}
            tone={
              displayCredit(balance.outstanding, balance.unallocatedCredit) > 0
                ? "info"
                : "default"
            }
            icon={<PiggyBank className="h-5 w-5" />}
            hint={
              displayCredit(balance.outstanding, balance.unallocatedCredit) > 0
                ? t("finance.balance.creditHint")
                : t("finance.balance.noCredit")
            }
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="flex w-full overflow-x-auto scrollbar-none sm:grid sm:grid-cols-5 [&_[data-slot=tabs-trigger]]:basis-auto [&_[data-slot=tabs-trigger]]:shrink-0">
          <TabsTrigger value="billing">{t("finance.billing")}</TabsTrigger>
          <TabsTrigger value="installments">
            {t("finance.installments")}
          </TabsTrigger>
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

        <TabsContent value="billing" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("finance.billing.intro")}
          </p>
          <BillingTab
            breakdown={billing}
            profiles={serviceProfiles}
            isLoading={ledgerEntries.isLoading || familyInstallments.isLoading}
            onRetry={() => {
              ledgerEntries.refetch();
              familyInstallments.refetch();
            }}
          />
        </TabsContent>

        <TabsContent value="installments" className="mt-4 space-y-3">
          {installments.isLoading ? (
            <ListSkeleton count={4} />
          ) : installments.isError ? (
            <ErrorState
              title={t("common.error.title")}
              onRetry={() => installments.refetch()}
            />
          ) : installments.data && installments.data.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {installments.data.map((inst) => (
                <InstallmentRowView
                  key={inst.id}
                  inst={inst}
                  kidName={activeKid ? formatFullName(activeKid) : undefined}
                />
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

        <TabsContent value="payments" className="mt-4 space-y-3">
          {payments.isLoading ? (
            <ListSkeleton count={4} />
          ) : payments.isError ? (
            <ErrorState
              title={t("common.error.title")}
              onRetry={() => payments.refetch()}
            />
          ) : payments.data && payments.data.length > 0 ? (
            <div className="space-y-4">
              {payments.data.map((p) => (
                <PaymentRowItem
                  key={p.id}
                  payment={p}
                  kidName={activeKid ? formatFullName(activeKid) : undefined}
                  parentInfo={parentInfo}
                  ledgerEntries={ledgerEntries.data ?? []}
                />
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

        <TabsContent value="ledger" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("finance.ledger.intro")}
          </p>
          <LedgerTimeline
            entries={
              activeKid
                ? (ledgerEntries.data ?? []).filter(
                    (e) => e.student_id === activeKid.id,
                  )
                : ledgerEntries.data
            }
            isLoading={ledgerEntries.isLoading}
            isError={ledgerEntries.isError}
            onRetry={() => ledgerEntries.refetch()}
          />
        </TabsContent>

        <TabsContent value="adjustments" className="mt-4 space-y-3">
          <AdjustmentsTab
            adjustments={adjustments}
            isLoading={ledgerEntries.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BillingTab({
  breakdown,
  profiles,
  isLoading,
  onRetry,
}: {
  breakdown: ParentBillingBreakdown | null;
  /** T-333: the exhaustive per-service pricing profiles (may lag the catalog fetch). */
  profiles: readonly ServicePricingProfile[] | null;
  isLoading: boolean;
  onRetry: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<"by_child" | "by_service">("by_child");

  if (isLoading) return <ListSkeleton count={4} />;
  if (!breakdown)
    return <ErrorState title={t("common.error.title")} onRetry={onRetry} />;
  if (
    breakdown.totalBilled <= 0 &&
    breakdown.byChild.every((c) => c.lineItems.length === 0)
  ) {
    return (
      <EmptyState
        title={t("finance.billing.noCharges")}
        description={t("finance.billing.noChargesBody")}
        icon={<Receipt className="h-6 w-6" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("finance.billing.year")} {breakdown.academicYear}
        </p>
        <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("by_child")}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded transition-colors",
              mode === "by_child"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpenText className="h-3.5 w-3.5" />{" "}
            {t("finance.billing.perChild")}
          </button>
          <button
            type="button"
            onClick={() => setMode("by_service")}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded transition-colors",
              mode === "by_service"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Scale className="h-3.5 w-3.5" /> {t("finance.billing.perService")}
          </button>
        </div>
      </div>

      {mode === "by_child" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {breakdown.byChild.map((child) => (
            <div
              key={child.student.id}
              className="rounded-xl border border-border/60 bg-card p-5 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <p className="font-semibold text-lg">{child.displayName}</p>
                <div className="text-right">
                  <p className="font-mono font-bold text-lg">
                    {formatCurrency(child.billedTotal)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("finance.billing.engagedTotal")}
                  </p>
                </div>
              </div>
              {child.lineItems.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {t("finance.billing.items")}
                  </p>
                  <ul className="divide-y divide-border/40 rounded border border-border/40 bg-muted/20 text-sm">
                    {child.lineItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {item.label}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {child.tranches.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {t("finance.billing.tranches")}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {child.tranches.map((tr) => {
                      const progress =
                        tr.amountDue > 0
                          ? Math.min(
                              100,
                              ((tr.amountPaid + tr.amountPending) /
                                tr.amountDue) *
                                100,
                            )
                          : 0;
                      const settled = tr.status === "paid" || tr.remaining <= 0;
                      return (
                        <div
                          key={tr.installmentId}
                          className={cn(
                            "rounded-md border p-3 text-xs space-y-2",
                            settled
                              ? "border-success/40 bg-success/5"
                              : tr.amountPaid + tr.amountPending > 0
                                ? "border-warning/40 bg-warning/5"
                                : "border-border",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold">
                              {tr.label}
                            </span>
                            {settled ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                            ) : (
                              <StatusPill
                                tone={
                                  paymentStatusTone(tr.status ?? "unpaid").tone
                                }
                              >
                                {t(
                                  paymentStatusTone(tr.status ?? "unpaid").key,
                                )}
                              </StatusPill>
                            )}
                          </div>
                          {tr.dueDate && (
                            <p className="text-[10px] text-muted-foreground">
                              {t("finance.installment.due")}{" "}
                              {formatDate(tr.dueDate)}
                            </p>
                          )}
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                settled ? "bg-success" : "bg-primary",
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span className="text-success font-medium">
                              {formatCurrency(tr.amountPaid)}{" "}
                              {t("finance.installment.paid").toLowerCase()}
                              {tr.amountPending > 0 && (
                                <span className="text-warning">
                                  {" "}
                                  • {formatCurrency(tr.amountPending)}{" "}
                                  {t(
                                    "finance.installment.pending",
                                  ).toLowerCase()}
                                </span>
                              )}
                            </span>
                            <span
                              className={
                                tr.remaining > 0
                                  ? "font-bold text-destructive"
                                  : "font-medium"
                              }
                            >
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
          {breakdown.unattributedItems.length > 0 && (
            <div className="rounded-xl border border-dashed border-border p-5 space-y-2 bg-muted/10">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                {t("finance.billing.familyItems")}
              </p>
              <ul className="divide-y divide-border/40 text-sm">
                {breakdown.unattributedItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatCurrency(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-right text-xs text-muted-foreground pt-2">
                {t("finance.billing.subtotal")} :{" "}
                <strong className="font-mono text-foreground text-sm">
                  {formatCurrency(breakdown.unattributedTotal)}
                </strong>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {breakdown.byService.map((svc) => (
            <ServicePricingCard
              key={svc.category}
              svc={svc}
              profile={profiles?.find((p) => p.category === svc.category) ?? null}
            />
          ))}
        </div>
      )}

      {/* Reconciliation Footer (Spans full width on desktop) */}
      <div className="mt-6 rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/50 px-5 py-3 border-b border-border/40">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground">
            {t("finance.billing.recon")}
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("finance.billing.recon.gross")}
              </span>
              <span className="font-mono font-semibold">
                {formatCurrency(breakdown.reconciliation.grossBilled)}
              </span>
            </div>
            {breakdown.reconciliation.adjustmentsCredit > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("finance.billing.recon.credit")}
                </span>
                <span className="font-mono text-success">
                  − {formatCurrency(breakdown.reconciliation.adjustmentsCredit)}
                </span>
              </div>
            )}
            {breakdown.reconciliation.adjustmentsDebit > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("finance.billing.recon.debit")}
                </span>
                <span className="font-mono text-destructive">
                  + {formatCurrency(breakdown.reconciliation.adjustmentsDebit)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border/40 font-medium">
              <span className="text-foreground">
                {t("finance.billing.recon.net")}
              </span>
              <span className="font-mono">
                {formatCurrency(breakdown.reconciliation.netDue)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("finance.billing.recon.cleared")}
              </span>
              <span className="font-mono text-success">
                − {formatCurrency(breakdown.reconciliation.clearedPaid)}
              </span>
            </div>
            {breakdown.reconciliation.pendingPaid > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("finance.billing.recon.pending")}
                </span>
                <span className="font-mono text-warning">
                  − {formatCurrency(breakdown.reconciliation.pendingPaid)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border/40 font-bold">
              <span className="text-foreground">
                {t("finance.billing.recon.remaining")}
              </span>
              <span className="font-mono text-lg">
                {formatCurrency(breakdown.reconciliation.derivedRemaining)}
              </span>
            </div>
          </div>
          <div className="space-y-2 flex flex-col justify-end">
            {breakdown.reconciliation.hasBridge && (
              <div className="flex items-center justify-between rounded bg-warning/10 px-3 py-2 text-xs mb-2">
                <span className="text-warning font-medium">
                  {t("finance.billing.recon.bridge")}
                </span>
                <span className="font-mono font-bold text-warning">
                  {formatCurrency(breakdown.reconciliation.bridge)}
                </span>
              </div>
            )}
            {breakdown.reconciliation.serverOutstanding != null && (
              <div className="flex items-center justify-between bg-primary/5 rounded-lg px-4 py-3 border border-primary/20">
                <span className="flex items-center gap-2 font-medium text-primary">
                  {!breakdown.reconciliation.hasBridge && (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                  {t("finance.billing.recon.server")}
                </span>
                <span
                  className={cn(
                    "font-mono font-bold text-lg",
                    breakdown.reconciliation.serverOutstanding > 0
                      ? "text-destructive"
                      : "text-success",
                  )}
                >
                  {formatCurrency(breakdown.reconciliation.serverOutstanding)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string | null | undefined }) {
  const { t } = useT();
  const map: Record<string, typeof BookOpenText> = {
    tuition: BookOpenText,
    transport: Bus,
  };
  const Icon = map[category ?? ""] ?? MoreHorizontal;
  const label = t(`finance.category.${category ?? "other"}`);
  const display = label.startsWith("finance.category.")
    ? (category ?? "—")
    : label;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info border border-info/20">
      <Icon className="h-3 w-3" />
      {display}
    </span>
  );
}

function InstallmentRowView({
  inst,
  kidName,
}: {
  inst: InstallmentRow;
  kidName?: string;
}) {
  const { t } = useT();
  const remaining = installmentRemainingAmount(inst);
  const pending = Number(inst.amount_pending ?? 0);
  const days = daysUntil(inst.due_date);
  const tone = paymentStatusTone(inst.status);
  const progress =
    inst.amount_due > 0
      ? Math.min(
          100,
          ((Number(inst.amount_paid) + pending) / Number(inst.amount_due)) *
            100,
        )
      : 0;
  const title =
    inst.label?.trim() ||
    `${t("finance.installment.tranche")} ${inst.tranche_number}`;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-base text-foreground">{title}</p>
            <StatusPill tone={tone.tone}>{t(tone.key)}</StatusPill>
            <CategoryBadge category={inst.category} />
          </div>
          <p className="text-sm text-muted-foreground">
            {kidName ? (
              <span className="font-medium text-foreground">{kidName} • </span>
            ) : (
              ""
            )}
            {t("finance.installment.due")} {formatDate(inst.due_date)}
            {inst.status !== "paid" && days >= 0 && days <= 7 && (
              <span className="ml-1 font-medium text-warning">
                • {t("finance.installment.daysLeft", { days })}
              </span>
            )}
            {inst.status !== "paid" && days < 0 && (
              <span className="ml-1 font-medium text-destructive">
                • {Math.abs(days)}j {t("finance.status.overdue").toLowerCase()}
              </span>
            )}
            {inst.payment_plan === "full_annual" && (
              <span className="ml-1 font-medium text-info">
                • {t("finance.installment.fullAnnual")}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-lg font-bold text-foreground">
            {formatCurrency(remaining)}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("finance.installment.remaining")}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground">
        <span>
          <span className="text-success">
            {formatCurrency(inst.amount_paid)}{" "}
            {t("finance.installment.paid").toLowerCase()}
          </span>
          {pending > 0 && (
            <span className="text-warning ml-1">
              {" "}
              • {formatCurrency(pending)}{" "}
              {t("finance.installment.pending").toLowerCase()}
            </span>
          )}
        </span>
        <span className="text-foreground">
          {formatCurrency(inst.amount_due)}
        </span>
      </div>
    </div>
  );
}

// Sub-component to show exactly how a payment was allocated.
// T-330: the derivation goes through the CANONICAL payment-coverage module
// (payment_allocations table -> ledger fallback -> single line) — the exact
// same chain the desktop's PaymentBreakdownCard applies, pinned by
// src/lib/canonical/payment-coverage.test.ts.
function PaymentCoverageDetails({
  payment,
  ledgerEntries,
}: {
  payment: PaymentRow;
  ledgerEntries: readonly LedgerEntryRow[];
}) {
  const { t } = useT();
  const allocations = usePaymentAllocations(payment.id);

  if (allocations.isLoading)
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  if (allocations.isError)
    return (
      <div className="p-4 text-xs text-destructive">
        {t("finance.payment.coverageLoadError")}
      </div>
    );

  // T-330: THE canonical chain — table rows primary, ledger-derived fallback
  // (receipt-number join), single-category line last. Same inputs → same
  // lines as the desktop card.
  const lines = paymentCoverageLines(
    payment,
    allocations.data ?? [],
    ledgerEntries,
  );
  // The table-row branch is authoritative when rows exist; the ledger and
  // single-line branches are the parity fallbacks.
  const fromServerTable = (allocations.data?.length ?? 0) > 0;

  const expectedAmount = payment.expected_amount;
  const excessAmount = payment.excess_amount;
  const hasExcess = (excessAmount ?? 0) > 0;
  const showExpected = (expectedAmount ?? 0) > 0;

  return (
    <div className="bg-muted/20 border-t border-border/40 p-4 space-y-3 rounded-b-xl">
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <PieChart className="h-3.5 w-3.5" />
        {t("finance.payment.coverage")}
      </h4>

      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex justify-between items-center text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0"
          >
            <div className="flex flex-col">
              <span className="font-medium text-foreground">
                {line.label ?? t(`finance.category.${line.category}`)}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase">
                {line.category}
              </span>
            </div>
            <span className="font-mono font-medium">
              {formatCurrency(line.amount)}
            </span>
          </li>
        ))}
      </ul>

      {!fromServerTable && (
        <p className="text-[10px] text-muted-foreground italic">
          {t("finance.payment.coverageDerivedHint")}
        </p>
      )}

      {(hasExcess || showExpected) && (
        <div className="pt-2 mt-2 border-t border-dashed border-border/60 space-y-1 text-sm">
          {showExpected && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("finance.payment.expectedAmount")}</span>
              <span className="font-mono">
                {formatCurrency(expectedAmount!)}
              </span>
            </div>
          )}
          {hasExcess && (
            <div className="flex justify-between font-medium text-info bg-info/10 p-1.5 rounded">
              <span>{t("finance.payment.excessAmount")}</span>
              <span className="font-mono">
                +{formatCurrency(excessAmount!)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentRowItem({
  payment,
  kidName,
  parentInfo,
  ledgerEntries,
}: {
  payment: PaymentRow;
  kidName?: string;
  parentInfo?: ReceiptParentInfo | null;
  ledgerEntries: readonly LedgerEntryRow[];
}) {
  const { t } = useT();
  const [showProof, setShowProof] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const tone = paymentStatusTone(payment.status);
  const receiptNo = payment.receipt_number ?? payment.payment_number;

  const downloadReceipt = async () => {
    setReceiptBusy(true);
    try {
      await downloadPaymentReceiptPdf(payment, parentInfo ?? undefined);
    } catch (e) {
      toast.error(t("common.error"));
    } finally {
      setReceiptBusy(false);
    }
  };

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
    <div className="rounded-xl border border-border/50 bg-card shadow-sm transition-all overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                <p className="font-mono text-lg font-bold text-foreground">
                  {formatCurrency(payment.amount)}
                </p>
                <StatusPill tone={tone.tone}>{t(tone.key)}</StatusPill>
                {payment.category && (
                  <CategoryBadge category={payment.category} />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t(`finance.payment.method.${payment.method}`)} •{" "}
                {formatDate(payment.collected_at)}
                {kidName && (
                  <span className="font-medium text-foreground">
                    {" "}
                    • {kidName}
                  </span>
                )}
                {receiptNo && (
                  <span>
                    {" "}
                    • {t("finance.payment.receipt")}{" "}
                    <span className="font-mono text-foreground">
                      {receiptNo}
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-2 shrink-0 border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0 mt-3 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCoverage(!showCoverage)}
              className="w-full sm:w-auto h-8 text-xs font-medium"
            >
              {showCoverage ? (
                <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
              )}
              {showCoverage
                ? t("finance.payment.coverage.hide")
                : t("finance.payment.coverage")}
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void downloadReceipt()}
                disabled={receiptBusy}
                className="flex-1 sm:flex-auto h-8 text-xs"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />{" "}
                {t("finance.receipt.download")}
              </Button>
              {payment.proof_path && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowProof(true)}
                  className="flex-1 sm:flex-auto h-8 text-xs"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />{" "}
                  {t("finance.payment.proof")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCoverage && (
        <PaymentCoverageDetails
          payment={payment}
          ledgerEntries={ledgerEntries}
        />
      )}

      <Dialog open={showProof} onOpenChange={setShowProof}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("finance.payment.proofTitle")}</DialogTitle>
            <DialogDescription>
              {formatCurrency(payment.amount)} •{" "}
              {formatDate(payment.collected_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {payment.method === "check" && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm space-y-2">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("finance.payment.checkNumber")}:
                  </span>{" "}
                  <span className="font-mono font-medium">
                    {payment.check_number ?? "—"}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("finance.payment.checkBank")}:
                  </span>{" "}
                  <span className="font-medium">
                    {payment.check_bank_name ?? "—"}
                  </span>
                </p>
                {payment.check_clearance_date && (
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("finance.payment.clearance")}:
                    </span>{" "}
                    <span className="font-medium">
                      {formatDate(payment.check_clearance_date)}
                    </span>
                  </p>
                )}
              </div>
            )}
            {payment.method === "transfer" && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm space-y-2">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("finance.payment.transferRef")}:
                  </span>{" "}
                  <span className="font-mono font-medium">
                    {payment.transfer_reference ?? "—"}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("finance.payment.transferBank")}:
                  </span>{" "}
                  <span className="font-medium">
                    {payment.transfer_source_bank ?? "—"}
                  </span>
                </p>
              </div>
            )}
            <Button onClick={viewProof} className="w-full" size="lg">
              <Download className="mr-2 h-4 w-4" />{" "}
              {t("finance.payment.openProof")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdjustmentsTab({
  adjustments,
  isLoading,
}: {
  adjustments: LedgerEntryRow[];
  isLoading: boolean;
}) {
  const { t } = useT();
  if (isLoading) return <ListSkeleton count={4} />;
  if (adjustments.length === 0)
    return (
      <EmptyState
        title={t("finance.adjustment.empty")}
        description={t("finance.adjustment.emptyBody")}
        icon={<Scale className="h-6 w-6" />}
      />
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {(() => {
        const classified = classifyAdjustmentRows(adjustments);
        return classified.map((c) => {
          const isCredit = c.kind === "credit";
          const pair = c.pairedWithId
            ? classified.find((x) => x.id === c.pairedWithId)
            : null;
          return (
            <div
              key={c.id}
              className="rounded-xl border border-border/50 bg-card p-4 flex flex-col justify-between"
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    isCredit
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning",
                  )}
                >
                  <Scale className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "font-mono text-lg font-bold",
                        isCredit ? "text-success" : "text-warning",
                      )}
                    >
                      {isCredit ? "−" : "+"}
                      {formatCurrency(Math.abs(c.amount))}
                    </p>
                    <StatusPill tone={isCredit ? "success" : "warning"}>
                      {c.badgeLabel}
                    </StatusPill>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatDate(c.at)}
                    </span>
                    <ProvenancePill
                      provenance={c.provenance}
                      label={c.provenanceLabel}
                    />
                    {c.receiptRef && (
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        {c.receiptRef}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
                <p
                  className={cn(
                    "text-sm font-medium",
                    c.isDiagnosticFallback && "italic text-muted-foreground",
                  )}
                >
                  {c.reasonLabel}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {c.meaningLabel}
                </p>
                {pair && (
                  <p className="mt-2 text-xs font-semibold text-warning bg-warning/10 px-2 py-1 rounded inline-block">
                    ↔ Paire annulée : {formatDate(pair.at)} —{" "}
                    {formatCurrency(Math.abs(pair.amount))}
                  </p>
                )}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}

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
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        tone,
      )}
    >
      {label}
    </span>
  );
}
