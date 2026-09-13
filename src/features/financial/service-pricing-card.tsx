"use client";

/**
 * service-pricing-card.tsx — T-333 (59th session, DATA-016): the exhaustive
 * per-service pricing card.
 *
 * The owner's mandate: "every single minute detail of what the price covers:
 * which year, which level, the tranche framework, every included service,
 * every condition, every component that contributes to the final price, and
 * the entire process" — rendered from the canonical
 * `servicePricingProfiles()` derivation (src/lib/canonical/), never
 * re-derived inline.
 *
 * Structure of the expandable detail (mirrors the profile's typed nodes):
 *   1. Couverture par enfant — grade level (code + label + cycle) + class
 *   2. Tarif officiel — the catalog reference (annual + T1/T2/T3 with due
 *      months, or unit/semester price + billing model)
 *   3. Conditions applicables — every rule that can modify the price
 *   4. Éléments facturés — every charge item with its decoded context
 *      (year / level / tranche / zone / plan) + provenance
 *   5. Remises appliquées — the adjustments actually applied
 *   6. Échéancier — the physical tranche framework
 *   7. Construction du prix — catalog → gross → − discounts → net → delta
 *
 * Every user-facing string routes through the dictionary (fr/ar/en) — the
 * t-214 guard scans this file.
 */

import { useState } from "react";
import { useT } from "@/lib/i18n/use-t";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusPill, paymentStatusTone } from "@/features/shared/status-pill";
import { ChevronDown, ChevronUp, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceTotalNode } from "@/lib/canonical/billing-breakdown";
import type {
  ServicePricingProfile,
  ChargeProvenance,
} from "@/lib/canonical/service-pricing-profile";

const MONTH_FORMATTERS: Record<string, Intl.DateTimeFormat> = {};
function monthLabel(locale: string, month: number): string {
  const key = locale;
  if (!MONTH_FORMATTERS[key]) {
    MONTH_FORMATTERS[key] = new Intl.DateTimeFormat(locale, { month: "long" });
  }
  return MONTH_FORMATTERS[key].format(new Date(2026, month - 1, 15));
}

function provenanceKey(p: ChargeProvenance): string {
  return `finance.svc.provenance.${p.source}`;
}

/* ─── Small presentational atoms ─────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function AmountRow({
  label,
  amount,
  strong,
  tone,
}: {
  label: string;
  amount: number;
  strong?: boolean;
  tone?: "success" | "destructive" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={cn("text-muted-foreground", strong && "font-semibold text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
          strong && "font-bold text-sm",
        )}
      >
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

/* ─── The card ───────────────────────────────────────────────────────────── */

export function ServicePricingCard({
  svc,
  profile,
}: {
  svc: ServiceTotalNode;
  profile: ServicePricingProfile | null;
}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-5 space-y-3">
      {/* Header — aggregate (unchanged look) + the year chip */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-base">{profile?.label ?? svc.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {svc.count} {t("finance.billing.elements")} · {t("finance.svc.year")}{" "}
            {profile?.academicYear ?? "—"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block font-mono font-bold text-lg text-primary">
            {formatCurrency(svc.amount)}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {svc.sharePct} % {t("finance.billing.share")}
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, svc.sharePct)}%` }}
        />
      </div>

      {/* Per-child attribution (unchanged compact rows) */}
      <div className="flex flex-col gap-1.5 pt-1">
        {svc.childAttribution.map((a) => (
          <div
            key={`${svc.category}-${a.studentId ?? "famille"}`}
            className="flex justify-between items-center text-xs text-muted-foreground bg-background rounded border border-border/40 px-2 py-1"
          >
            <span>{a.studentName}</span>
            <strong className="font-mono text-foreground">
              {formatCurrency(a.amount)}
            </strong>
          </div>
        ))}
      </div>

      {/* The exhaustive detail toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`svc-detail-toggle-${svc.category}`}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/50 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? t("finance.svc.detail.hide") : t("finance.svc.detail")}
      </button>

      {open && (
        <div className="space-y-4 rounded-lg border border-border/40 bg-background p-4" data-testid={`svc-detail-${svc.category}`}>
          {/* 1 — Per-child coverage */}
          <div>
            <Label>{t("finance.svc.coverage")}</Label>
            <div className="space-y-2">
              {(profile?.childCoverage ?? []).map((c) => (
                <div
                  key={c.studentId ?? "famille"}
                  className="rounded border border-border/40 bg-muted/20 p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{c.studentName}</span>
                    <span className="font-mono font-bold">{formatCurrency(c.amount)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-muted-foreground">
                    {c.gradeLevelLabel && (
                      <Chip>
                        {t("finance.svc.level")} : {c.gradeLevelLabel}
                      </Chip>
                    )}
                    {c.cycle && <Chip>{t("finance.svc.cycle")} : {c.cycle}</Chip>}
                    {c.classLabel && (
                      <Chip>
                        {t("finance.svc.class")} : {c.classLabel}
                      </Chip>
                    )}
                    {c.studentCode && (
                      <Chip>
                        {t("finance.svc.code")} : {c.studentCode}
                      </Chip>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2 — Official catalog reference */}
          <div>
            <Label>{t("finance.svc.catalog")}</Label>
            {(profile?.catalog ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("finance.svc.construction.noCatalog")}
              </p>
            ) : (
              <div className="space-y-2">
                {(profile?.catalog ?? []).map((ref, i) => (
                  <div
                    key={`${ref.kind}-${ref.studentId ?? "f"}-${i}`}
                    className="rounded border border-border/40 bg-muted/20 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {t(`finance.svc.catalog.kind.${ref.kind}`)} · {ref.scopeLabel}
                      </span>
                      {ref.annualAmount != null && (
                        <span className="font-mono font-bold">
                          {formatCurrency(ref.annualAmount)}
                        </span>
                      )}
                    </div>
                    {ref.tranches.length > 0 && (
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                        {ref.tranches.map((tr) => (
                          <div
                            key={tr.n}
                            className="rounded bg-background border border-border/40 px-2 py-1"
                          >
                            <p className="text-[10px] text-muted-foreground">
                              {t("finance.svc.catalog.tranche", { n: tr.n })} ·{" "}
                              {t("finance.svc.catalog.dueMonth", {
                                month: monthLabel(locale, tr.dueMonth),
                              })}
                            </p>
                            <p className="font-mono text-[11px] font-semibold">
                              {formatCurrency(tr.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 text-muted-foreground">
                      {ref.unitAmount != null && (
                        <Chip>
                          {t("finance.svc.catalog.unit")} : {formatCurrency(ref.unitAmount)}
                        </Chip>
                      )}
                      {ref.semesterAmount != null && (
                        <Chip>
                          {t("finance.svc.catalog.semester")} :{" "}
                          {formatCurrency(ref.semesterAmount)}
                        </Chip>
                      )}
                      {ref.billingModel && (
                        <Chip>
                          {t("finance.svc.catalog.model", { model: ref.billingModel })}
                        </Chip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3 — Applicable conditions */}
          <div>
            <Label>{t("finance.svc.conditions")}</Label>
            <div className="flex flex-col gap-1.5">
              {(profile?.conditions ?? []).map((c, i) => (
                <div
                  key={`${c.kind}-${c.code ?? i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1">
                    {c.label}
                    {c.deadline && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {t("finance.svc.cond.deadline", { date: formatDate(c.deadline) })}
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-semibold">
                    {c.kind === "late_penalty"
                      ? t("finance.svc.cond.perday", { v: c.value })
                      : c.valueType === "percentage"
                        ? t("finance.svc.cond.pct", { v: c.value })
                        : t("finance.svc.cond.fixed", { v: c.value })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4 — Billed items (the itemized "what") */}
          <div>
            <Label>{t("finance.svc.items", { n: profile?.items.length ?? 0 })}</Label>
            <div className="space-y-2">
              {(profile?.items ?? []).map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-border/40 bg-muted/20 p-2.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 font-medium">{item.description || "—"}</span>
                    <span className="font-mono font-bold">{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-muted-foreground">
                    <Chip>{item.studentName}</Chip>
                    {item.academicYear && <Chip>{item.academicYear}</Chip>}
                    {item.gradeLevelCode && (
                      <Chip>
                        {t("finance.svc.level")} : {item.gradeLevelCode}
                      </Chip>
                    )}
                    {item.trancheNumber != null && (
                      <Chip>{t("finance.svc.item.tranche", { n: item.trancheNumber })}</Chip>
                    )}
                    {item.destination && (
                      <Chip>{t("finance.svc.item.zone", { zone: item.destination })}</Chip>
                    )}
                    {item.paymentPlan && (
                      <Chip>{t("finance.svc.item.plan", { plan: item.paymentPlan })}</Chip>
                    )}
                    <Chip>{t(provenanceKey(item.provenance))}</Chip>
                    {item.provenance.importRunId && (
                      <Chip>
                        {t("finance.svc.provenance.run", { id: item.provenance.importRunId })}
                      </Chip>
                    )}
                    {item.provenance.reconciliation && <Chip>{item.provenance.reconciliation}</Chip>}
                    <Chip>{formatDate(item.at)}</Chip>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5 — Applied discounts */}
          <div>
            <Label>{t("finance.svc.discounts")}</Label>
            {(profile?.appliedDiscounts ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("finance.svc.discounts.none")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {(profile?.appliedDiscounts ?? []).map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-success/30 bg-success/5 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1">
                      {d.label} · {d.studentName}
                    </span>
                    <span className="font-mono font-semibold text-success">
                      − {formatCurrency(d.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6 — The installment framework */}
          <div>
            <Label>{t("finance.svc.plan")}</Label>
            {(profile?.installmentPlan ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("finance.svc.plan.none")}</p>
            ) : (
              <div className="space-y-1.5">
                {(profile?.installmentPlan ?? []).map((tr) => {
                  const settled = tr.status === "paid" || tr.remaining <= 0;
                  return (
                    <div
                      key={tr.installmentId}
                      className={cn(
                        "rounded border p-2.5 text-xs space-y-1",
                        settled
                          ? "border-success/40 bg-success/5"
                          : "border-border/40 bg-muted/20",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {tr.studentName} · {tr.label}
                        </span>
                        {settled ? (
                          <span className="font-mono text-[11px] text-success">
                            {formatCurrency(tr.amountDue)}
                          </span>
                        ) : (
                          <StatusPill tone={paymentStatusTone(tr.status ?? "unpaid").tone}>
                            {t(paymentStatusTone(tr.status ?? "unpaid").key)}
                          </StatusPill>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          {t("finance.svc.plan.due")} : {tr.dueDate ? formatDate(tr.dueDate) : "—"}
                        </span>
                        <span className="font-mono">
                          {formatCurrency(tr.amountPaid)} / {formatCurrency(tr.amountDue)}
                        </span>
                        {tr.remaining > 0 && (
                          <span className="font-mono font-bold text-destructive">
                            → {formatCurrency(tr.remaining)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 7 — Price construction */}
          <div>
            <Label>{t("finance.svc.construction")}</Label>
            <div className="space-y-1.5 rounded border border-border/40 bg-muted/20 p-2.5">
              {profile?.construction.catalogAnnual != null ? (
                <AmountRow
                  label={t("finance.svc.construction.catalog")}
                  amount={profile.construction.catalogAnnual}
                  tone="muted"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("finance.svc.construction.noCatalog")}
                </p>
              )}
              <AmountRow
                label={t("finance.svc.construction.gross")}
                amount={profile?.construction.billedGross ?? 0}
              />
              {(profile?.construction.discountsTotal ?? 0) > 0 && (
                <AmountRow
                  label={t("finance.svc.construction.discounts")}
                  amount={profile?.construction.discountsTotal ?? 0}
                  tone="success"
                />
              )}
              <AmountRow
                label={t("finance.svc.construction.net")}
                amount={profile?.construction.billedNet ?? 0}
                strong
              />
              {profile?.construction.deltaVsCatalog != null &&
                Math.abs(profile.construction.deltaVsCatalog) > 0 && (
                  <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Scale className="h-3.5 w-3.5" />
                      {t("finance.svc.construction.delta")}
                    </span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        profile.construction.deltaVsCatalog > 0
                          ? "text-destructive"
                          : "text-success",
                      )}
                    >
                      {profile.construction.deltaVsCatalog > 0 ? "+" : "−"}{" "}
                      {formatCurrency(Math.abs(profile.construction.deltaVsCatalog))}
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
