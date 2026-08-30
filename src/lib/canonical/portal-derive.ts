/**
 * portal-derive.ts — Website-side canonical derivations.
 *
 * This module is the ONLY place in the web portal where financial and
 * academic aggregates are computed. It maps raw database rows onto the
 * canonical engine (the byte-identical port of the desktop domain layer,
 * see src/lib/canonical/) and computes:
 *
 *   - Parent financial summary  → computeParentSummary (INV-1: balances are
 *     replayed from ledger entries, never from installment sums).
 *   - Installment remaining/progress → remaining = max(0, due − paid − pending)
 *     (Invariant 4: uncleared funds never mark a tranche paid).
 *   - Subject average + overall GPA → computeSubjectAverage / computeOverallGpa
 *     (coefficient-weighted, extracurricular excluded, (D1+D2+2×Ex)/4 default).
 *   - Attendance rate → calculateAttendanceRate (canonical rounding).
 *
 * Cross-platform equivalence of every function here is enforced by the
 * cross-platform equivalence suite (Android ↔ Desktop ↔ Website ↔ Backend).
 */

import type { LedgerEntryRow, InstallmentRow, AssessmentRow, AttendanceRecordRow } from "@/lib/types/database";
// T-049: PaymentStatus/PaymentCategory/PaymentMethod are declared (and
// re-exported only via ./model/payment) — "./model/ledger" imports them
// but does not re-export, so importing them from there is TS2459.
import type { LedgerEntry, LedgerEntryType, LedgerSourceType } from "./model/ledger";
import type { PaymentStatus, PaymentCategory, PaymentMethod } from "./model/payment";
import type { ParentLedgerSummary } from "./model/ledger";
import { computeParentSummary } from "./calc/ledger/balance";
import { buildOverdueDueDateMap } from "./calc/ledger/overdue";
import { computeSubjectAverage, computeOverallGpa, calculateAttendanceRate } from "./model/academic";
import { clampNonNegative } from "./calc/shared/money";

// ─── Ledger replay ───────────────────────────────────────────────────────────

/**
 * Map a backend `ledger_entries` row onto the canonical engine's LedgerEntry.
 *
 * Wire format notes (kept byte-compatible with the desktop/Android mappers):
 *   - `amount` is DZD (numeric) — the canonical engine uses DZD numbers.
 *   - `entry_type`/`source_type`/`category`/`method` are lowercase wire codes.
 *   - Unknown enum codes fall back the same way Android's `fromCode` totals do.
 */
export function ledgerEntryFromRow(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.entry_number ?? row.id ?? "",
    tenantId: row.tenant_id,
    accountId: row.account_id,
    parentId: row.parent_id,
    studentId: row.student_id ?? null,
    category: asPaymentCategory(row.category),
    amount: Number(row.amount),
    type: asEntryType(row.entry_type),
    sourceType: asSourceType(row.source_type),
    sourceId: row.source_id ?? "",
    method: row.method ? asPaymentMethod(row.method) : null,
    receiptNumber: row.receipt_number ?? null,
    paymentStatus: row.payment_status ? asPaymentStatus(row.payment_status) : null,
    reversesId: row.reverses_id ?? null,
    description: row.description ?? "",
    actorId: row.actor_id ?? "",
    actorName: row.actor_name ?? "",
    at: row.at,
    // T-049: cast to the declared metadata shape (row.metadata is unknown).
    metadata: (row.metadata ?? {}) as Readonly<Record<string, string | number | boolean | null>>,
  };
}

/**
 * Canonical parent summary for the portal — the SAME function the desktop
 * debt dashboard and the backend `compute_parent_summary` RPC run (INV-10).
 * Overdue detection follows INV-4: balance > 0.001 DZD AND due date < now.
 */
export function parentSummaryFromLedger(
  rows: readonly LedgerEntryRow[],
  parentId: string,
  parentName: string,
  now: Date = new Date(),
): ParentLedgerSummary {
  const entries = rows.map(ledgerEntryFromRow);
  const overdueDueDates = buildOverdueDueDateMap(entries);
  return computeParentSummary(entries, parentId, parentName, overdueDueDates, now);
}

/** Portal KPI values derived from the canonical summary. */
export interface PortalFinancialSummary {
  /** Total owed across every account (ledger replay — INV-1). */
  outstanding: number;
  /** Overdue subset (INV-4). */
  overdue: number;
  /** Banked credit held by the school on the parent's behalf (INV-3, ≤ 0). */
  unallocatedCredit: number;
  totalCharged: number;
  totalPaid: number;
  totalPending: number;
}

export function portalFinancialSummary(
  rows: readonly LedgerEntryRow[],
  parentId: string,
  now: Date = new Date(),
): PortalFinancialSummary {
  const summary = parentSummaryFromLedger(rows, parentId, "", now);
  return {
    outstanding: summary.totalOutstanding,
    overdue: summary.totalOverdue,
    unallocatedCredit: summary.totalUnallocatedCredit,
    totalCharged: summary.totalCharged,
    totalPaid: summary.totalPaid,
    totalPending: summary.totalPending,
  };
}

/**
 * Remaining amount on one installment — canonical Invariant-4 semantics:
 * uncleared (pending) funds reduce what the parent still owes but never
 * mark the tranche paid. This mirrors the BACKEND waterfall (`amount_due −
 * amount_paid − amount_pending`, migration 0034) and the Android
 * `Installment.remaining` — NOT the desktop's cleared-only variant.
 */
export function installmentRemainingAmount(inst: InstallmentRow): number {
  return clampNonNegative(
    Number(inst.amount_due) - Number(inst.amount_paid) - Number(inst.amount_pending ?? 0),
  );
}

// ─── Ledger presentation derivations (read-side, pure) ──────────────────────

/**
 * One ledger row prepared for the portal statement timeline.
 *
 * The ledger is the system's source of truth (INV-1): charges raise the
 * balance (+), payments/refunds lower it (−), adjustments move it either
 * way. `runningBalance` is the cumulative parent balance AFTER the entry,
 * replayed in chronological order — the same replay the canonical engine
 * performs, exposed for the statement view.
 */
export interface LedgerTimelineItem {
  readonly entry: LedgerEntryRow;
  /** Cumulative balance after this entry (chronological replay). */
  readonly runningBalance: number;
  /** ISO month bucket (YYYY-MM) for grouping in the UI. */
  readonly month: string;
}

/**
 * Build the chronological statement timeline with a running balance.
 * Entries are sorted by `at` ascending (stable: entry_number tiebreaker)
 * and the balance accumulates the SIGNED amount exactly as stored —
 * payment entries are negative in the wire format, so plain summation
 * matches the canonical balance replay.
 */
export function ledgerTimeline(rows: readonly LedgerEntryRow[]): LedgerTimelineItem[] {
  const sorted = [...rows].sort((a, b) => {
    const at = new Date(a.at).getTime() - new Date(b.at).getTime();
    if (at !== 0) return at;
    return (a.entry_number ?? a.id ?? "").localeCompare(b.entry_number ?? b.id ?? "");
  });
  let balance = 0;
  return sorted.map((row) => {
    balance += Number(row.amount);
    return {
      entry: row,
      runningBalance: balance,
      month: (row.at ?? "").slice(0, 7),
    };
  });
}

/**
 * Adjustment entries for the portal's Adjustments section.
 *
 * WHY: the dedicated `account_adjustments` table is empty in production —
 * every adjustment produced by the Excel import landed in `ledger_entries`
 * (entry_type='adjustment', 318 live rows). Reading the dead table left the
 * portal's Adjustments tab permanently blank; this derivation surfaces the
 * real rows. Newest first for display.
 */
export function ledgerAdjustmentEntries(
  rows: readonly LedgerEntryRow[]
): LedgerEntryRow[] {
  return rows
    .filter((r) => r.entry_type === "adjustment")
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

// ─── Academics ───────────────────────────────────────────────────────────────

export interface PortalAssessmentInput {
  readonly devoir1: number | null;
  readonly devoir2: number | null;
  readonly examen: number | null;
  readonly coefficient: number;
  readonly isExtracurricular: boolean;
}

/**
 * Subject average for one assessment row — canonical rule: only computable
 * when ALL THREE marks are present; (D1 + D2 + 2×Ex)/4 in integer-scaled
 * cents (half-up, 2 decimals — matches SQL ROUND(numeric,2) and the Android
 * centi-scaled engine bit-for-bit).
 */
export function subjectAverageFor(assessment: PortalAssessmentInput): number | null {
  return computeSubjectAverage(assessment.devoir1, assessment.devoir2, assessment.examen);
}

/**
 * Overall GPA across assessments — coefficient-weighted, extracurricular
 * subjects excluded, null subject averages skipped (canonical INV: matches
 * SQL fn_calculate_student_term_gpa and both native engines).
 */
export function overallGpaFor(
  assessments: readonly PortalAssessmentInput[],
  fallbackStoredAverages?: readonly (number | null)[],
): number | null {
  const rows = assessments.map((a, i) => {
    const stored = fallbackStoredAverages?.[i];
    const recomputed = subjectAverageFor(a);
    // Prefer the canonical recomputation; fall back to the stored
    // subject_average for legacy rows where per-component marks are absent.
    const subjectAverage = recomputed ?? (stored != null ? stored : null);
    return {
      subjectAverage,
      coefficient: a.coefficient,
      isExtracurricular: a.isExtracurricular,
    };
  });
  return computeOverallGpa(rows);
}

/** Pass threshold — canonical default 10.00/20 (desktop DEFAULT_PASSING_GRADE). */
export const DEFAULT_PASSING_GRADE = 10.0;

export function isPassing(gpa: number | null, grade: number = DEFAULT_PASSING_GRADE): boolean {
  return gpa != null && gpa >= grade;
}

/** Map an `assessments` row (with its joined subject) to the GPA input. */
export function assessmentGpaInput(
  row: Pick<AssessmentRow, "devoir1" | "devoir2" | "examen" | "coefficient" | "subject_average">,
  subjectIsExtracurricular: boolean,
): PortalAssessmentInput {
  return {
    devoir1: row.devoir1 ?? null,
    devoir2: row.devoir2 ?? null,
    examen: row.examen ?? null,
    coefficient: Number(row.coefficient ?? 1),
    isExtracurricular: subjectIsExtracurricular,
  };
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | "present"
  | "absent_excused"
  | "absent_unexcused"
  | "late";

/**
 * Canonical attendance rate (0..1, 2-decimal rounding) — identical to the
 * desktop `calculateAttendanceRate` (present + late count as attended).
 * Returns a PERCENT (0..100) for direct portal display.
 */
export function attendanceRatePercent(
  records: readonly { status: AttendanceStatus | string }[],
): number {
  const mapped = records.map((r, i) => ({
    id: `att-${i}`,
    studentId: "s",
    classId: "c",
    date: "2026-01-01",
    session: "morning" as const,
    status: (r.status === "present" || r.status === "absent_excused"
      ? r.status
      : r.status === "absent_unexcused" ? "absent_unexcused" : "late") as AttendanceStatus,
    // T-049: AttendanceRecord carries audit fields the rate calculation
    // never reads — fill them with neutral placeholders.
    arrivalTime: null,
    note: null,
    recordedBy: "portal",
    recordedAt: "2026-01-01",
    syncedAt: null,
  }));
  return Math.round(calculateAttendanceRate(mapped) * 100);
}

// ─── Wire-code mappers (mirror Android Ledger.fromCode totals) ──────────────
const ENTRY_TYPES: readonly LedgerEntryType[] = [
  "charge",
  "payment",
  "adjustment",
  "refund",
  "reversal",
  "transfer",
];

const SOURCE_TYPES: readonly LedgerSourceType[] = [
  "installment",
  "payment",
  "expense",
  "adjustment",
  "refund",
  "bulk_import",
  "manual_entry",
];

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "partial",
  "paid",
  "overdue",
  "refunded",
  "cancelled",
  "pending_clearance",
  "unpaid",
];

const PAYMENT_CATEGORIES: readonly PaymentCategory[] = [
  "tuition",
  "transport",
  "canteen",
  "uniform",
  "books",
  "extracurricular",
  "therapy_psychology",
  "therapy_speech",
  "second_apron",
  "parent_credit",
  "other",
];

const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "check", "transfer"];

function asEntryType(v: string | null | undefined): LedgerEntryType {
  return ENTRY_TYPES.find((t) => t === v) ?? "charge";
}
function asSourceType(v: string | null | undefined): LedgerSourceType {
  return SOURCE_TYPES.find((t) => t === v) ?? "adjustment";
}
export function asPaymentStatus(v: string | null | undefined): PaymentStatus {
  return PAYMENT_STATUSES.find((s) => s === v) ?? "pending";
}
export function asPaymentCategory(v: string | null | undefined): PaymentCategory {
  return PAYMENT_CATEGORIES.find((c) => c === v) ?? "other";
}
function asPaymentMethod(v: string | null | undefined): PaymentMethod {
  return PAYMENT_METHODS.find((m) => m === v) ?? "cash";
}
