"use client";

/**
 * StudentEnrollmentsCard — the per-child ENROLLMENTS surface (T-211).
 *
 * Owner mandate (32nd session, 2026-09-07): "the children's enrollments"
 * were missing from the portal entirely. Two canonical data sources, both
 * read-only:
 *
 *   1. `service_enrollments` (migration 0007) — the per-child service
 *      enrollments: tuition, transport (with destination), canteen, club,
 *      speech therapy, psychology, psychotherapy, second aprron,
 *      rattrapage. Rendered with kind labels, the annual amount and the
 *      per-tranche amounts + due dates. NOTE: this table is EMPTY on the
 *      live DB today (the Excel import wrote installments + ledger, not
 *      service rows) — the section renders its empty state until the
 *      staff desktop populates it. The hook useServiceEnrollments shipped
 *      with ZERO consumers; this card is its first (32nd-session
 *      discovery, documented in the task registry).
 *
 *   2. `installments` (0007 + 0032) — the REAL per-student fee schedule
 *      (1 276 live rows, 100% student-attributed: tuition + transport).
 *      This is the enrollment billing the parents actually have today:
 *      tranche label, category, amount due vs paid, due date and status
 *      (tone reused from the financial view's canonical
 *      paymentStatusTone — no second status-tone implementation).
 *
 *   3. `academic_years` (is_current) — the "Année scolaire 2026-2027"
 *      context line for the whole section.
 *
 * All amounts render through the canonical formatCurrency. No financial
 * write exists here (the portal is read-mostly by design).
 */

import { useT } from "@/lib/i18n/use-t";
import {
  useServiceEnrollments,
  useInstallmentsForStudent,
  useCurrentAcademicYear,
  useTransportDestination,
} from "@/lib/hooks/portal-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, CalendarRange, ListChecks, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusPill, paymentStatusTone } from "@/features/shared/status-pill";
import type { ServiceEnrollmentRow, InstallmentRow } from "@/lib/types/database";

/** service_kind → i18n key. Reuses the finance.category.* labels where the
 * canonical kinds map 1:1 (tuition/transport/canteen/therapy/second
 * aprron/other); club/rattrapage/psychotherapy get dedicated keys. */
const serviceKindLabels: Record<string, string> = {
  tuition: "finance.category.tuition",
  transport: "finance.category.transport",
  canteen: "finance.category.canteen",
  club: "enrollments.service.club",
  speech_therapy: "finance.category.therapy_speech",
  psychology: "finance.category.therapy_psychology",
  psychotherapy: "enrollments.service.psychotherapy",
  second_apron: "finance.category.second_apron",
  rattrapage: "enrollments.service.rattrapage",
  other: "finance.category.other",
};

export function StudentEnrollmentsCard({ studentId }: { studentId: string }) {
  const { t } = useT();
  const services = useServiceEnrollments(studentId);
  const schedule = useInstallmentsForStudent(studentId);
  const year = useCurrentAcademicYear();

  const loading = services.isLoading || schedule.isLoading;

  return (
    <CardContent className="border-t border-border/60 pt-4">
      <CardTitle className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          {t("enrollments.title")}
        </span>
        {year.data && (
          <span className="flex items-center gap-1 font-normal normal-case">
            <CalendarRange className="h-3 w-3" />
            {t("enrollments.academicYear")}: {year.data.label}
          </span>
        )}
      </CardTitle>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-4">
          <ServiceEnrollmentsSection data={services.data ?? []} />
          <FeeScheduleSection data={schedule.data ?? []} />
        </div>
      )}
    </CardContent>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Service enrollments (canonical table — empty on the live DB today)      */
/* -------------------------------------------------------------------------- */

function ServiceEnrollmentsSection({ data }: { data: ServiceEnrollmentRow[] }) {
  const { t } = useT();

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {t("enrollments.services")}
      </p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("enrollments.servicesEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((enr) => (
            <li
              key={enr.id}
              className="rounded-lg border border-border/60 p-2.5"
              data-testid={`service-enrollment-${enr.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  {enr.service_kind === "transport" && <Bus className="h-4 w-4 shrink-0 text-primary" />}
                  {t(serviceKindLabels[enr.service_kind] ?? "finance.category.other")}
                  {!enr.is_active && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {t("enrollments.inactive")}
                    </span>
                  )}
                </span>
                <span className="break-words text-sm font-semibold">
                  {formatCurrency(enr.annual_amount)}
                </span>
              </div>
              {enr.service_kind === "transport" && enr.destination_id && (
                <TransportDestinationLine destinationId={enr.destination_id} />
              )}
              <TrancheSchedule enr={enr} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TransportDestinationLine({ destinationId }: { destinationId: string }) {
  const { t } = useT();
  const destination = useTransportDestination(destinationId);
  const label = destination.data
    ? destination.data.label_fr || destination.data.label_ar || destination.data.code
    : null;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {t("enrollments.destination")}: {label ?? "…"}
    </p>
  );
}

function TrancheSchedule({ enr }: { enr: ServiceEnrollmentRow }) {
  const { t } = useT();
  const tranches = [
    { n: 1, amount: enr.tranche_1_amount, due: enr.tranche_1_due_date },
    { n: 2, amount: enr.tranche_2_amount, due: enr.tranche_2_due_date },
    { n: 3, amount: enr.tranche_3_amount, due: enr.tranche_3_due_date },
  ].filter((tr) => tr.amount > 0);
  if (tranches.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
      {tranches.map((tr) => (
        <p key={tr.n} className="min-w-0 break-words">
          <span className="font-medium">
            {t("finance.installment.tranche")} {tr.n}:
          </span>{" "}
          {formatCurrency(tr.amount)}
          {tr.due ? ` — ${formatDate(tr.due)}` : ""}
        </p>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. The REAL fee schedule — per-student installments (live data)            */
/* -------------------------------------------------------------------------- */

function FeeScheduleSection({ data }: { data: InstallmentRow[] }) {
  const { t } = useT();

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {t("enrollments.feeSchedule")}
      </p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("enrollments.feeScheduleEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {data.map((inst) => (
            <li
              key={inst.id}
              className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 p-2.5"
              data-testid={`installment-${inst.id}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {inst.label?.trim() ||
                    `${t("finance.installment.tranche")} ${inst.tranche_number}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("finance.installment.due")}: {formatDate(inst.due_date)}
                  {inst.category ? ` · ${t(`finance.category.${inst.category}`)}` : ""}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="break-words text-sm font-semibold">
                  {formatCurrency(inst.amount_due)}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {formatCurrency(inst.amount_paid)}
                </span>
                <StatusPill tone={paymentStatusTone(inst.status).tone}>
                  {t(paymentStatusTone(inst.status).key)}
                </StatusPill>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
