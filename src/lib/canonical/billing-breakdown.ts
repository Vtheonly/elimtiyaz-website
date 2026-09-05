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
 *   - T-168: adjustment PROVENANCE classification (`classifyAdjustmentRows`)
 *     — documented (actual content) / reversal_pair (net-zero +X/−X pair
 *     from a re-import) / undocumented (legacy blank row to audit), the
 *     per-service share % + child attribution, family-level unattributed
 *     items, and the adjustment-aware reconciliation with an explicit
 *     bridge to the server balance. Same FR wording and the SAME pairing
 *     algorithm as the desktop `classifyAdjustmentHistory` and the Android
 *     mirror — pinned by the shared corpus below.
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

export interface ServiceChildAttribution {
  readonly studentId: string | null;
  readonly studentName: string;
  readonly amount: number;
}

export interface ServiceTotalNode {
  readonly category: string;
  readonly label: string;
  readonly amount: number;
  readonly count: number;
  /** T-168: share of `totalBilled`, 0–100 rounded (display-only). */
  readonly sharePct: number;
  /** T-168: per-child attribution inside this service. */
  readonly childAttribution: readonly ServiceChildAttribution[];
}

export interface ParentBillingBreakdown {
  readonly academicYear: string;
  /** Σ charge entries (matches the ledger `totalCharged` family figure). */
  readonly totalBilled: number;
  readonly byChild: readonly ChildBillingBreakdown[];
  readonly byService: readonly ServiceTotalNode[];
  /** T-168: family-level charges with no child attribution (multi-child). */
  readonly unattributedItems: readonly BillingLineItem[];
  readonly unattributedTotal: number;
  /** T-168: adjustment-aware reconciliation (may be absent on old callers). */
  readonly reconciliation: BillingReconciliation;
}

/**
 * T-168 — adjustment-aware reconciliation (identical equation on every
 * platform):
 *
 *   grossBilled − adjustmentsCredit + adjustmentsDebit = netDue
 *   netDue − clearedPaid − pendingPaid               = derivedRemaining
 *   derivedRemaining + bridge                        = serverOutstanding
 */
export interface BillingReconciliation {
  readonly grossBilled: number;
  readonly adjustmentsCredit: number;
  readonly adjustmentsDebit: number;
  readonly adjustmentsCount: number;
  readonly netDue: number;
  readonly clearedPaid: number;
  readonly pendingPaid: number;
  readonly derivedRemaining: number;
  readonly serverOutstanding: number | null;
  readonly bridge: number;
  readonly hasBridge: boolean;
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

/* ─── T-168: adjustment provenance classification ───────────────────── */

/** Same classes as the desktop engine (billing-breakdown.ts T-168). */
export type AdjustmentProvenance = "documented" | "reversal_pair" | "undocumented";

/** One classified adjustment row (view model for the portal list). */
export interface ClassifiedAdjustmentRow {
  readonly id: string;
  readonly amount: number;
  readonly at: string;
  readonly approvedBy: string;
  readonly kind: "credit" | "debit";
  readonly badgeLabel: string;
  readonly reasonLabel: string;
  readonly isDiagnosticFallback: boolean;
  readonly provenance: AdjustmentProvenance;
  readonly provenanceLabel: string;
  readonly meaningLabel: string;
  readonly pairedWithId: string | null;
  readonly receiptRef: string | null;
}

export const ADJUSTMENT_PROVENANCE_LABELS_FR: Record<AdjustmentProvenance, string> = {
  documented: "Documenté",
  reversal_pair: "Contrepassation",
  undocumented: "Non documenté",
};

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
/** T-168: optional inputs feeding the adjustment-aware reconciliation. */
export interface BillingReconciliationInput {
  /** Ledger adjustment rows (`ledgerAdjustmentEntries(...)` output). */
  readonly adjustmentRows?: readonly LedgerEntryRow[];
  /** Σ cleared payments (payment_status === "paid") — from `portalFinancialSummary`. */
  readonly clearedPaid?: number;
  /** Σ pending payments (cheques / transfers not yet cleared). */
  readonly pendingPaid?: number;
  /** Server-replayed balance (`summary.outstanding`). */
  readonly serverOutstanding?: number | null;
}

export function parentBillingBreakdown(
  ledgerRows: readonly LedgerEntryRow[],
  installmentRows: readonly InstallmentRow[],
  kids: readonly StudentRow[],
  reconInput: BillingReconciliationInput = {},
): ParentBillingBreakdown {
  const chargeRows = ledgerRows.filter((r) => r.entry_type === "charge");
  const academicYear = resolveBillingAcademicYear(chargeRows);

  const totalBilled = chargeRows.reduce((s, r) => s + Number(r.amount), 0);

  const displayNameOf = (kidId: string | null): string => {
    if (kidId == null) return "Famille";
    const k = kids.find((x) => x.id === kidId);
    return k ? `${k.first_name} ${k.last_name}`.trim() : "Famille";
  };

  const byChild: ChildBillingBreakdown[] = kids.map((kid) => {
    // Per-child attribution; a single-child family OWNS the family-level
    // rows too (T-168: mirrors the desktop fix — direct charges PLUS null
    // student_id rows, so the itemization stays exhaustive). Legacy import
    // rows can carry null student_id.
    let childCharges = chargeRows.filter((r) => r.student_id === kid.id);
    if (kids.length === 1) {
      const familyLevel = chargeRows.filter((r) => r.student_id == null);
      childCharges = [...childCharges, ...familyLevel];
      if (childCharges.length === 0 && chargeRows.length > 0) {
        childCharges = chargeRows;
      }
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

  // T-168: family-level charges with no child attribution (multi-child) —
  // surfaced explicitly so the shopping list stays exhaustive.
  const unattributedItems: BillingLineItem[] =
    kids.length > 1
      ? chargeRows
          .filter((r) => r.student_id == null || !kids.some((k) => k.id === r.student_id))
          .map((r) => ({
            id: r.entry_number ?? r.id ?? `${r.parent_id}-${r.at}`,
            label: r.description?.trim() || serviceLabelOf(r.category),
            category: r.category,
            amount: Number(r.amount),
          }))
      : [];
  const unattributedTotal = unattributedItems.reduce((s, i) => s + i.amount, 0);

  // Per-service consolidation (canonical wording, sorted by amount desc) —
  // T-168: share % + per-child attribution.
  const map = new Map<
    string,
    { node: ServiceTotalNode; byChild: Map<string, ServiceChildAttribution> }
  >();
  for (const r of chargeRows) {
    const category = r.category ?? "other";
    const entry = map.get(category) ?? {
      node: {
        category,
        label: serviceLabelOf(category),
        amount: 0,
        count: 0,
        sharePct: 0,
        childAttribution: [],
      },
      byChild: new Map<string, ServiceChildAttribution>(),
    };
    entry.node = {
      ...entry.node,
      amount: entry.node.amount + Number(r.amount),
      count: entry.node.count + 1,
    };
    const key = r.student_id ?? "__family__";
    const existing = entry.byChild.get(key);
    entry.byChild.set(key, {
      studentId: r.student_id ?? null,
      studentName: displayNameOf(r.student_id ?? null),
      amount: (existing?.amount ?? 0) + Number(r.amount),
    });
    map.set(category, entry);
  }
  const byService = [...map.values()]
    .map(({ node, byChild }) => ({
      ...node,
      sharePct: totalBilled > 0 ? Math.round((node.amount / totalBilled) * 100) : 0,
      childAttribution: [...byChild.values()].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  // T-168: adjustment-aware reconciliation.
  const adjustmentRows = reconInput.adjustmentRows ?? [];
  let adjustmentsCredit = 0;
  let adjustmentsDebit = 0;
  for (const r of adjustmentRows) {
    const amount = Number(r.amount);
    if (amount < 0) adjustmentsCredit += -amount;
    else adjustmentsDebit += amount;
  }
  const clearedPaid = reconInput.clearedPaid ?? 0;
  const pendingPaid = reconInput.pendingPaid ?? 0;
  const netDue = totalBilled + adjustmentsDebit - adjustmentsCredit;
  const derivedRemaining = netDue - clearedPaid - pendingPaid;
  const serverOutstanding = reconInput.serverOutstanding ?? null;
  const bridge = serverOutstanding == null ? 0 : serverOutstanding - derivedRemaining;
  const reconciliation: BillingReconciliation = {
    grossBilled: totalBilled,
    adjustmentsCredit,
    adjustmentsDebit,
    adjustmentsCount: adjustmentRows.length,
    netDue,
    clearedPaid,
    pendingPaid,
    derivedRemaining,
    serverOutstanding,
    bridge,
    hasBridge: Math.abs(bridge) > 1,
  };

  return {
    academicYear,
    totalBilled,
    byChild,
    byService,
    unattributedItems,
    unattributedTotal,
    reconciliation,
  };
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

/* ─── T-168: adjustment provenance classification ─────────────────────── */

/** Meaning sentence for a provenance class + direction (identical FR wording
 *  to the desktop `meaningLabelOf` and the Android mirror). */
function meaningLabelOf(provenance: AdjustmentProvenance, isCredit: boolean): string {
  switch (provenance) {
    case "reversal_pair":
      return "Écriture annulée par une écriture inverse du même montant (probable ré-import ou correction d'erreur). Effet net sur le solde : nul.";
    case "undocumented":
      return isCredit
        ? "Entrée héritée sans motif (import système antérieur à la contrainte 0069) : déduction au motif inconnu — à auditer."
        : "Entrée héritée sans motif (import système antérieur à la contrainte 0069) : rétablissement de dette au motif inconnu — à auditer.";
    case "documented":
      return isCredit
        ? "Contenu réel : remise ou déduction appliquée par un opérateur, motif documenté — réduit le solde dû."
        : "Contenu réel : majoration ou annulation de remise appliquée par un opérateur, motif documenté — augmente le solde dû.";
  }
}

function adjustmentRowId(row: LedgerEntryRow): string {
  return row.entry_number ?? row.id ?? `${row.parent_id}-${row.at}-${row.amount}`;
}

/**
 * Classify the family's adjustment rows (T-168).
 *
 * Reversal-pair detection — IDENTICAL algorithm on every platform
 * (desktop TS / website TS / Android Kotlin): chronological order
 * (at, then id), a pool per |amount| of unmatched entries, FIFO pairing
 * ONLY across opposite signs, paired rows → "reversal_pair", blank reason
 * → "undocumented", everything else → "documented". Pure function; the
 * input order is irrelevant (sorted internally) and the caller's order is
 * preserved in the returned list.
 */
export function classifyAdjustmentRows(
  rows: readonly LedgerEntryRow[],
): readonly ClassifiedAdjustmentRow[] {
  const chronological = [...rows]
    .map((r) => ({ row: r, amount: Number(r.amount), id: adjustmentRowId(r) }))
    .filter((e) => e.amount !== 0)
    .sort((a, b) => {
      const t = a.row.at.localeCompare(b.row.at);
      return t !== 0 ? t : a.id.localeCompare(b.id);
    });

  // |amount| → FIFO queue of unmatched entries (opposite-sign pairing only).
  const pool = new Map<number, Array<{ id: string; isCredit: boolean }>>();
  const pairedWith = new Map<string, string>();
  for (const entry of chronological) {
    const magnitude = Math.abs(entry.amount);
    const isCredit = entry.amount < 0;
    const queue = pool.get(magnitude) ?? [];
    const siblingIndex = queue.findIndex((q) => q.isCredit !== isCredit);
    if (siblingIndex >= 0) {
      const siblingId = queue[siblingIndex].id;
      queue.splice(siblingIndex, 1);
      pairedWith.set(entry.id, siblingId);
      pairedWith.set(siblingId, entry.id);
    } else {
      queue.push({ id: entry.id, isCredit });
    }
    pool.set(magnitude, queue);
  }

  return rows.map((row) => {
    const diagnostic = describeAdjustment(row);
    const amount = Number(row.amount);
    const stored = row.description?.trim();
    const hasReason = !!stored && stored.length > 0;
    const id = adjustmentRowId(row);
    const pairedWithId = pairedWith.get(id) ?? null;
    const provenance: AdjustmentProvenance = pairedWithId
      ? "reversal_pair"
      : hasReason
        ? "documented"
        : "undocumented";
    return {
      id,
      amount,
      at: row.at,
      approvedBy: row.actor_name ?? row.actor_id ?? "system",
      kind: diagnostic.kind,
      badgeLabel: diagnostic.badgeLabel,
      reasonLabel: diagnostic.reasonLabel,
      isDiagnosticFallback: diagnostic.isDiagnosticFallback,
      provenance,
      provenanceLabel: ADJUSTMENT_PROVENANCE_LABELS_FR[provenance],
      meaningLabel: meaningLabelOf(provenance, diagnostic.kind === "credit"),
      pairedWithId,
      receiptRef: row.receipt_number ?? null,
    };
  });
}
