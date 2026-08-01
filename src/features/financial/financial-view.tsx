"use client";

/**
 * FinancialView — parent-facing financial ledger.
 *
 * Per the Platform Feature Allocation Matrix, the web portal can:
 *   - View Dues (balance + installments)
 *   - View Schedule (installment tranches)
 *   - View Scans (check/transfer proof images)
 *   - View Balance (debt dashboard — own family only)
 *   - PDF Download (receipts + statements)
 *   - View Adjustments (discounts with reason code + admin note)
 *
 * The portal CANNOT:
 *   - Make payments (use desktop counter-payment flow)
 *   - Issue invoices (desktop-only)
 *   - Apply adjustments (admin-only)
 *   - Refund payments (admin-only)
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import {
  useInstallments,
  usePayments,
  useInvoices,
  useReceiptsForPayment,
  useReceipts,
  useAccountAdjustments,
} from "@/lib/hooks/portal-queries";
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
import {
  Wallet,
  CalendarClock,
  Receipt,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Scale,
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
import type { PaymentRow, InstallmentRow, AccountAdjustmentRow, ReceiptRow } from "@/lib/types/database";

type TabKey = "installments" | "payments" | "invoices" | "adjustments" | "receipts";

export function FinancialView() {
  const { t } = useT();
  const { parent, children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);

  // Realtime: balance updates the moment staff records a payment on desktop.
  useFinancialRealtime(parent?.id ?? null);

  // Filter by active student if set, otherwise show all parent installments
  const installments = useInstallments(parent?.id ?? null, {
    studentId: activeKid?.id ?? null,
    limit: 100,
  });
  const payments = usePayments(parent?.id ?? null, {
    studentId: activeKid?.id ?? null,
    limit: 50,
  });
  const invoices = useInvoices(parent?.id ?? null, { limit: 50 });
  const adjustments = useAccountAdjustments(parent?.id ?? null, { limit: 50 });
  const receipts = useReceipts(parent?.id ?? null, { limit: 50 });

  const [activeTab, setActiveTab] = useState<TabKey>("installments");

  // Aggregate balance
  const balance = useMemo(() => {
    if (!installments.data) return { due: 0, paid: 0, total: 0 };
    return installments.data.reduce(
      (acc, i) => ({
        due: acc.due + Math.max(0, i.amount_due - i.amount_paid),
        paid: acc.paid + i.amount_paid,
        total: acc.total + i.amount_due,
      }),
      { due: 0, paid: 0, total: 0 }
    );
  }, [installments.data]);

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

      {/* KPI row */}
      {installments.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label={t("finance.balance.outstanding")}
            value={formatCurrency(balance.due)}
            tone={balance.due > 0 ? "danger" : "success"}
            icon={<Wallet className="h-5 w-5" />}
            hint={balance.due > 0 ? t("finance.balance.outstanding") : t("finance.balance.settled")}
          />
          <KpiCard
            label={t("finance.installment.paid")}
            value={formatCurrency(balance.paid)}
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <KpiCard
            label={t("finance.installment.amount")}
            value={formatCurrency(balance.total)}
            tone="info"
            icon={<CalendarClock className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="installments">{t("finance.installments")}</TabsTrigger>
          <TabsTrigger value="payments">{t("finance.payments")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("finance.invoices")}</TabsTrigger>
          <TabsTrigger value="adjustments">{t("finance.adjustments")}</TabsTrigger>
          <TabsTrigger value="receipts">{t("finance.receipts")}</TabsTrigger>
        </TabsList>

        {/* Installments */}
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
            <EmptyState title={t("finance.empty.noInstallments")} icon={<CalendarClock className="h-6 w-6" />} />
          )}
        </TabsContent>

        {/* Payments */}
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
            <EmptyState title={t("finance.empty.noPayments")} icon={<Receipt className="h-6 w-6" />} />
          )}
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="mt-4 space-y-3">
          {invoices.isLoading ? (
            <ListSkeleton count={4} />
          ) : invoices.isError ? (
            <ErrorState title={t("common.error.title")} onRetry={() => invoices.refetch()} />
          ) : invoices.data && invoices.data.length > 0 ? (
            <div className="space-y-2">
              {invoices.data.map((inv) => {
                const tone = paymentStatusTone(inv.status);
                return (
                  <CardListItem
                    key={inv.id}
                    leading={
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
                        <FileText className="h-4 w-4" />
                      </div>
                    }
                    title={`${inv.invoice_number} • ${formatCurrency(inv.amount)}`}
                    subtitle={`${formatDate(inv.issue_date)} • ${t("finance.installment.due")} ${formatDate(inv.due_date)}`}
                    trailing={<StatusPill tone={tone.tone}>{t(tone.key)}</StatusPill>}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState title={t("finance.empty.noPayments")} icon={<FileText className="h-6 w-6" />} />
          )}
        </TabsContent>

        {/* Adjustments */}
        <TabsContent value="adjustments" className="mt-4 space-y-3">
          <AdjustmentsTab adjustments={adjustments} />
        </TabsContent>

        {/* Receipts + Statements */}
        <TabsContent value="receipts" className="mt-4 space-y-3">
          <ReceiptsTab receipts={receipts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function InstallmentRowView({ inst, kidName }: { inst: InstallmentRow; kidName?: string }) {
  const { t } = useT();
  const remaining = Math.max(0, inst.amount_due - inst.amount_paid);
  const days = daysUntil(inst.due_date);
  const tone = paymentStatusTone(inst.status);
  const progress = inst.amount_due > 0 ? Math.min(100, (inst.amount_paid / inst.amount_due) * 100) : 0;

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {t("finance.installment.tranche")} {inst.tranche_number}
            </p>
            <StatusPill tone={tone.tone}>{t(tone.key)}</StatusPill>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {kidName ? `${kidName} • ` : ""}
            {t("finance.installment.due")} {formatDate(inst.due_date)}
            {inst.status !== "paid" && days >= 0 && days <= 7 && (
              <span className="ml-1 text-warning">• J-{days}</span>
            )}
            {inst.status !== "paid" && days < 0 && (
              <span className="ml-1 text-destructive">• {Math.abs(days)}j {t("finance.status.overdue").toLowerCase()}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono font-semibold">{formatCurrency(remaining)}</p>
          <p className="text-xs text-muted-foreground">
            {t("finance.installment.remaining")}
          </p>
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
        <span>{formatCurrency(inst.amount_paid)} {t("finance.installment.paid").toLowerCase()}</span>
        <span>{formatCurrency(inst.amount_due)}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PaymentRowItem({ payment, kidName }: { payment: PaymentRow; kidName?: string }) {
  const { t } = useT();
  const { data: receipt, isLoading } = useReceiptsForPayment(payment.id);
  const [showProof, setShowProof] = useState(false);

  const downloadReceipt = async () => {
    if (!receipt?.pdf_path || !supabase) {
      toast.error(t("finance.payment.viewReceipt") + " — indisponible");
      return;
    }
    const { data, error } = await supabase.storage
      .from("receipts")
      .download(receipt.pdf_path);
    if (error) {
      toast.error(error.message);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recu-${receipt.receipt_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="rounded-lg border border-border/50 bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
          <Receipt className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono font-semibold">{formatCurrency(payment.amount)}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {t(`finance.payment.method.${payment.method}`)} • {formatDate(payment.collected_at)}
            {kidName ? ` • ${kidName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tone="success">{t("finance.status.paid")}</StatusPill>
        </div>
      </div>

      {/* Action row */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-2">
        {receipt?.pdf_path && (
          <Button variant="ghost" size="sm" onClick={downloadReceipt} disabled={isLoading}>
            <Download className="mr-1 h-3.5 w-3.5" />
            {t("finance.payment.viewReceipt")}
          </Button>
        )}
        {payment.proof_path && (
          <Button variant="ghost" size="sm" onClick={() => setShowProof(true)}>
            <FileText className="mr-1 h-3.5 w-3.5" />
            Justificatif
          </Button>
        )}
      </div>

      {/* Proof dialog */}
      <Dialog open={showProof} onOpenChange={setShowProof}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificatif de paiement</DialogTitle>
            <DialogDescription>
              {formatCurrency(payment.amount)} • {formatDate(payment.collected_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {payment.method === "check" && (
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p><span className="text-muted-foreground">N° chèque:</span> {payment.check_number ?? "—"}</p>
                <p><span className="text-muted-foreground">Banque:</span> {payment.check_bank_name ?? "—"}</p>
                {payment.check_clearance_date && (
                  <p><span className="text-muted-foreground">Encaissement:</span> {formatDate(payment.check_clearance_date)}</p>
                )}
              </div>
            )}
            {payment.method === "transfer" && (
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p><span className="text-muted-foreground">Référence:</span> {payment.transfer_reference ?? "—"}</p>
                <p><span className="text-muted-foreground">Banque émettrice:</span> {payment.transfer_source_bank ?? "—"}</p>
              </div>
            )}
            <Button onClick={viewProof} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Ouvrir le justificatif
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
}: {
  adjustments: ReturnType<typeof useAccountAdjustments>;
}) {
  const { t } = useT();

  if (adjustments.isLoading) {
    return <ListSkeleton count={4} />;
  }
  if (adjustments.isError) {
    return <ErrorState title={t("common.error.title")} onRetry={() => adjustments.refetch()} />;
  }
  if (!adjustments.data || adjustments.data.length === 0) {
    return (
      <EmptyState
        title={t("finance.adjustment.empty")}
        icon={<Scale className="h-6 w-6" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {adjustments.data.map((adj) => (
        <AdjustmentRow key={adj.id} adj={adj} />
      ))}
    </div>
  );
}

function AdjustmentRow({ adj }: { adj: AccountAdjustmentRow }) {
  const { t } = useT();
  const isCredit = adj.amount < 0;
  const reasonLabel = t(`finance.adjustment.reason.${adj.reason_code}`, {});
  // Fallback: if the i18n key returns the key itself (no translation), render the raw code.
  const displayReason = reasonLabel.startsWith("finance.adjustment.reason.") ? adj.reason_code : reasonLabel;

  return (
    <CardListItem
      leading={
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            isCredit ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}
        >
          <Scale className="h-4 w-4" />
        </div>
      }
      title={`${isCredit ? "−" : "+"}${formatCurrency(Math.abs(adj.amount))}`}
      subtitle={`${displayReason} • ${formatDate(adj.performed_at)}`}
      trailing={
        <StatusPill tone={isCredit ? "success" : "warning"}>
          {isCredit ? "Crédit" : "Débit"}
        </StatusPill>
      }
    />
  );
}

/* -------------------------------------------------------------------------- */

function ReceiptsTab({
  receipts,
}: {
  receipts: ReturnType<typeof useReceipts>;
}) {
  const { t } = useT();

  const downloadReceipt = async (r: ReceiptRow) => {
    if (!r.pdf_path || !supabase) {
      toast.error("PDF indisponible");
      return;
    }
    const { data, error } = await supabase.storage
      .from("receipts")
      .download(r.pdf_path);
    if (error) {
      toast.error(error.message);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.receipt_kind === "account_statement" ? "releve" : "recu"}-${r.receipt_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (receipts.isLoading) {
    return <ListSkeleton count={4} />;
  }
  if (receipts.isError) {
    return <ErrorState title={t("common.error.title")} onRetry={() => receipts.refetch()} />;
  }
  if (!receipts.data || receipts.data.length === 0) {
    return (
      <EmptyState
        title={t("finance.empty.noPayments")}
        icon={<Receipt className="h-6 w-6" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {receipts.data.map((r) => (
        <CardListItem
          key={r.id}
          leading={
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
          }
          title={`${r.receipt_number} • ${r.receipt_kind === "account_statement" ? t("finance.statement.download") : t("finance.receipt.download")}`}
          subtitle={formatDate(r.generated_at)}
          trailing={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadReceipt(r)}
              aria-label={t("common.download")}
            >
              <Download className="h-4 w-4" />
            </Button>
          }
        />
      ))}
    </div>
  );
}
