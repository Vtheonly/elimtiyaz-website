/**
 * billing-breakdown.ts — Website-side canonical derivation for the
 * "Prestations facturées / Facturation" view (T-166, session 26).
 *
 * This is the READ-SIDE port of the desktop's
 * `domain/calc/payment/billing-breakdown.ts` (T-164). Per ADR-002 and the
 * T-057 port-honesty rule, the portal must NOT re-implement the pricing /
 * waterfall engine (40/30/30 synthesis, payment allocation) — physical
 * `installments` rows carry the server-side waterfall results and are
 * rendered verbatim. What this module does derive (purely from ledger +
 * installment rows, the same inputs every platform reads):
 *
 *   - The itemized charge breakdown ("shopping list") per child and the
 *     consolidated per-service totals.
 *   - Per-child tranche coverage from REAL installment rows only
 *     (INV-4 remaining via `installmentRemainingAmount`).
 *   - The billing academic year (charge metadata → description →
 *     fallback), matching the desktop resolver's priority order.
 *   - Adjustment diagnostics (`describeAdjustment`) — credit/debit badge
 *     label + human-readable reason with the same fallback wording as the
 *     desktop drawer and the Android terminal, so every platform labels
 *     the same row identically.
 *
 * Equivalence with the desktop engine is enforced by the shared corpus
 * test (`billing-breakdown.test.ts` — same headline scenarios as
 * `src/tests/domain/payment/billing-breakdown.test.ts` in the hub repo).
 */
import type { LedgerEntryRow, InstallmentRow, StudentRow } from "@/lib/types/database";
import { installmentRemainingAmount } from "./portal-derive";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface BillingLineItem {
  readonly id: string;
  readonly label: string;
  readonly category: string | null;
  readonly amount: number;
}

export interface ChildTrancheCoverage {
  readonly installmentId: string;
  readonly label: string;
  readonly trancheNumber: number | null;
  readonly dueDate: string | null;
  readonly amountDue: number;
  readonly amountPaid: number;
  readonly amountPending: number;
  readonly remaining: number;
  readonly status: string | null;
}

export interface ChildBillingBreakdown {
  readonly student: StudentRow;
  readonly displayName: string;
  /** Σ charge entries attributed to this child (single-child → family). */
  readonly billedTotal: number;
  readonly lineItems: readonly BillingLineItem[];
  /** REAL installment rows for this child (no synthesis on the portal). */
  readonly tranches: readonly ChildTrancheCoverage[];
}

export interface ServiceTotalNode {
  readonly category: string;
  readonly label: string;
  readonly amount: number;
  readonly count: number;
}

export interface ParentBillingBreakdown {
  readonly academicYear: string;
  /** Σ charge entries (matches the ledger `totalCharged` family figure). */
  readonly totalBilled: number;
  readonly byChild: readonly ChildBillingBreakdown[];
  readonly byService: readonly ServiceTotalNode[];
}

export interface AdjustmentDiagnostic {
  readonly kind: "credit" | "debit";
  /** "Crédit / Déduction" | "Débit / Majoration" (same wording as desktop). */
  readonly badgeLabel: string;
  /** Stored description, or the shared system diagnostic when blank. */
  readonly reasonLabel: string;
  /** True when the stored description was blank. */
  readonly isDiagnosticFallback: boolean;
}

/* ─── Labels (FR — same wording as the desktop engine) ──────────────────── */

const SERVICE_LABELS_FR: Record<string, string> = {
  tuition: "Scolarité",
  transport: "Transport",
  canteen: "Cantine",
  uniform: "Tenue / Uniforme",
  books: "Fournitures & Livres",
  extracurricular: "Activités parascolaires",
  therapy_psychology: "Accompagnement psychologique",
  therapy_speech: "Orthophonie",
  second_apron: "Deuxième tablier",
  parent_credit: "Crédit parent",
  other: "Autres prestations",
};

const DEFAULT_ACADEMIC_YEAR = "2025-2026";
const ACADEMIC_YEAR_PATTERN = /20\d{2}[-/]20\d{2}/;

/** FR service label for a wire category code (canonical wording). */
export function serviceLabelOf(category: string | null | undefined): string {
  if (!category) return SERVICE_LABELS_FR.other;
  return SERVICE_LABELS_FR[category] ?? SERVICE_LABELS_FR.other;
}

/* ─── Academic year ─────────────────────────────────────────────────────── */

/**
 * Resolve the billing academic year — same priority chain as the desktop
 * `resolveBillingAcademicYear`: charge metadata → charge description →
 * fallback. (The portal does not read class placements, so the chain
 * stops at the fallback "2025-2026".)
 */
export function resolveBillingAcademicYear(rows: readonly LedgerEntryRow[]): string {
  for (const row of rows) {
    if (row.entry_type !== "charge") continue;
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta?.academicYear) return String(meta.academicYear);
    const match = row.description?.match(ACADEMIC_YEAR_PATTERN);
    if (match) return match[0];
  }
  return DEFAULT_ACADEMIC_YEAR;
}

/** Map an installment row to the coverage node (INV-4 remaining). */
function toTrancheCoverage(i: InstallmentRow): ChildTrancheCoverage {
  return {
    installmentId: i.id,
    label: i.label?.trim() || `Tranche ${i.tranche_number}`,
    trancheNumber: i.tranche_number,
    dueDate: i.due_date,
    amountDue: Number(i.amount_due),
    amountPaid: Number(i.amount_paid),
    amountPending: Number(i.amount_pending ?? 0),
    remaining: installmentRemainingAmount(i),
    status: i.status,
  };
}

/* ─── Main derivation ───────────────────────────────────────────────────── */

/**
 * Compute the parent-facing itemized billing breakdown.
 *
 * Pure: takes the family's ledger rows, installment rows and children;
 * returns the view model rendered by the Facturation tab. Amounts come
 * straight from the rows (Number() on the numeric wire values).
 */
export function parentBillingBreakdown(
  ledgerRows: readonly LedgerEntryRow[],
  installmentRows: readonly InstallmentRow[],
  kids: readonly StudentRow[],
): ParentBillingBreakdown {
  const chargeRows = ledgerRows.filter((r) => r.entry_type === "charge");
  const academicYear = resolveBillingAcademicYear(chargeRows);

  const totalBilled = chargeRows.reduce((s, r) => s + Number(r.amount), 0);

  const byChild: ChildBillingBreakdown[] = kids.map((kid) => {
    // Per-child attribution; a single-child family inherits all charges
    // (legacy import rows can carry null student_id).
    let childCharges = chargeRows.filter((r) => r.student_id === kid.id);
    if (childCharges.length === 0 && kids.length === 1) {
      childCharges = chargeRows.filter((r) => r.student_id == null);
      if (childCharges.length === 0) childCharges = chargeRows;
    }
    const billedTotal = childCharges.reduce((s, r) => s + Number(r.amount), 0);
    const lineItems: BillingLineItem[] = childCharges.map((r) => ({
      id: r.entry_number ?? r.id ?? `${r.parent_id}-${r.at}`,
      label: r.description?.trim() || serviceLabelOf(r.category),
      category: r.category,
      amount: Number(r.amount),
    }));
    const tranches: ChildTrancheCoverage[] = installmentRows
      .filter((i) => i.student_id === kid.id)
      .slice()
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
      .map(toTrancheCoverage);
    // Single-child family: family-scoped rows (null student_id, legacy import
    // shape) belong to that child — mirrors the desktop attribution rule.
    const tranchesForChild =
      tranches.length > 0
        ? tranches
        : kids.length === 1
          ? installmentRows
              .filter((i) => i.student_id == null)
              .slice()
              .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
              .map(toTrancheCoverage)
          : [];
    return {
      student: kid,
      displayName: `${kid.first_name} ${kid.last_name}`.trim(),
      billedTotal,
      lineItems,
      tranches: tranchesForChild,
    };
  });

  // Per-service consolidation (canonical wording, sorted by amount desc).
  const map = new Map<string, ServiceTotalNode>();
  for (const r of chargeRows) {
    const category = r.category ?? "other";
    const existing = map.get(category);
    if (existing) {
      map.set(category, {
        ...existing,
        amount: existing.amount + Number(r.amount),
        count: existing.count + 1,
      });
    } else {
      map.set(category, {
        category,
        label: serviceLabelOf(category),
        amount: Number(r.amount),
        count: 1,
      });
    }
  }
  const byService = [...map.values()].sort((a, b) => b.amount - a.amount);

  return { academicYear, totalBilled, byChild, byService };
}

/* ─── Adjustment diagnostics ────────────────────────────────────────────── */

/**
 * Badge + reason diagnostics for a ledger adjustment row.
 *
 * Ledger convention: negative = credit/remise (reduces what the family
 * owes), positive = debit/majoration (adds debt). Wording is identical to
 * the desktop `describeAdjustment` and the Android port so the same row
 * renders the same way on every platform.
 */
export function describeAdjustment(row: LedgerEntryRow): AdjustmentDiagnostic {
  const amount = Number(row.amount);
  const isCredit = amount < 0;
  const stored = row.description?.trim();
  const hasReason = !!stored && stored.length > 0;
  return {
    kind: isCredit ? "credit" : "debit",
    badgeLabel: isCredit ? "Crédit / Déduction" : "Débit / Majoration",
    reasonLabel: hasReason
      ? stored
      : isCredit
        ? "Déduction / remise enregistrée automatiquement par le système (motif non documenté)"
        : "Régularisation / rétablissement de dette (contrepassation automatique, motif non documenté)",
    isDiagnosticFallback: !hasReason,
  };
}
