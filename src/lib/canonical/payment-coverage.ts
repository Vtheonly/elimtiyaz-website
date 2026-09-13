/**
 * Payment coverage derivation — the canonical "what does this payment cover"
 * chain, ported VERBATIM from the desktop's PaymentBreakdownCard
 * (elimtiyaz-desktop/src/features/financials/payment-breakdown-card.tsx).
 *
 * T-330 (58th session, 2026-09-13): the owner mandated that the website's
 * payment-coverage view use "the exact same calculation and allocation logic
 * as the desktop application" and that "the same inputs should produce the
 * same results on both platforms". The desktop derives coverage lines as:
 *
 *   1. PRIMARY (canonical server record): `payment_allocations` rows for the
 *      payment — written server-side by the collect_and_allocate_payment
 *      waterfall RPC (migration 0033 created the table for exactly this
 *      purpose: "Enables the Payment Breakdown UI feature").
 *   2. FALLBACK (legacy payments with no allocation rows): the ledger-entry
 *      derivation — every payment ledger entry sharing the payment's
 *      receipt_number represents one allocation (category + |amount| + the
 *      metadata.field label).
 *   3. LAST RESORT: a single line with the payment's own category + amount.
 *
 * The desktop's current code path only implements (2)→(3) (it never reads
 * the table); the website's previous iteration only implemented (1) with an
 * empty-state message. This module implements the FULL chain (1)→(2)→(3) so
 * both platforms converge: the website calls it with the table rows + the
 * ledger replay it already holds; the desktop's card aligns to the same
 * order in T-330's desktop half.
 *
 * Pure functions, no IO — parity-pinnable by the shared test corpus
 * (see payment-coverage.test.ts).
 */

import type { LedgerEntryRow, PaymentAllocationRow, PaymentRow } from "@/lib/types/database";

/** One coverage line — the shape BOTH platforms render. */
export interface CoverageLine {
  key: string;
  category: string;
  amount: number;
  label: string | null;
}

/**
 * The desktop's metadata.field accessor, made type-safe for the website's
 * `metadata: unknown` column: reads `metadata.field` when the metadata is an
 * object carrying a string `field`, else null. (Desktop:
 * `(e.metadata?.field as string) ?? null` — same semantics.)
 */
function metadataFieldLabel(metadata: unknown): string | null {
  if (typeof metadata === "object" && metadata !== null) {
    const field = (metadata as { field?: unknown }).field;
    if (typeof field === "string" && field.length > 0) return field;
  }
  return null;
}

/**
 * Desktop derivation (verbatim port): every payment-type ledger entry whose
 * receipt_number equals the payment's represents ONE allocation.
 *
 * Desktop source (payment-breakdown-card.tsx):
 *   matching = entries.filter(e => e.receiptNumber === payment.receiptNumber
 *                                  && e.type === "payment")
 *   built    = matching.map(e => ({ category: e.category,
 *                                   allocatedAmount: Math.abs(e.amount),
 *                                   label: e.metadata?.field ?? null }))
 *
 * The payment-row fallback for the receipt key mirrors PaymentRowItem's
 * `receipt_number ?? payment_number` display rule.
 */
export function deriveAllocationsFromLedger(
  payment: Pick<PaymentRow, "id" | "receipt_number" | "payment_number" | "category" | "amount">,
  ledgerEntries: readonly LedgerEntryRow[],
): CoverageLine[] {
  const receiptKey = payment.receipt_number ?? payment.payment_number;
  if (!receiptKey) return [];
  return ledgerEntries
    .filter(
      (e) =>
        e.entry_type === "payment" &&
        e.receipt_number !== null &&
        e.receipt_number === receiptKey,
    )
    .map((e) => ({
      key: `${payment.id}-${e.id ?? e.entry_number}`,
      category: e.category,
      amount: Math.abs(e.amount),
      label: metadataFieldLabel(e.metadata),
    }));
}

/** Map the canonical table rows to coverage lines (order-preserving). */
export function allocationRowsToLines(
  rows: readonly PaymentAllocationRow[],
): CoverageLine[] {
  return rows.map((r) => ({
    key: r.id,
    category: r.category,
    amount: r.allocated_amount,
    label: r.label ?? null,
  }));
}

/**
 * THE full derivation chain — same inputs, same outputs on every platform:
 *
 *   payment_allocations rows (server waterfall record)  →  primary
 *   ledger-derived allocations                          →  fallback
 *   single line { payment.category, payment.amount }    →  last resort
 *
 * The desktop's PaymentBreakdownCard applies the identical precedence
 * (its allocations ARE the ledger derivation; the table read lands ahead of
 * it in the T-330 desktop half).
 */
export function paymentCoverageLines(
  payment: Pick<PaymentRow, "id" | "receipt_number" | "payment_number" | "category" | "amount">,
  allocationRows: readonly PaymentAllocationRow[],
  ledgerEntries: readonly LedgerEntryRow[],
): CoverageLine[] {
  const fromTable = allocationRowsToLines(allocationRows);
  if (fromTable.length > 0) return fromTable;

  const fromLedger = deriveAllocationsFromLedger(payment, ledgerEntries);
  if (fromLedger.length > 0) return fromLedger;

  // Last resort: a single-category payment (desktop renders the payment's
  // own category + total as one line).
  return [
    {
      key: `${payment.id}-single`,
      category: payment.category ?? "other",
      amount: payment.amount,
      label: null,
    },
  ];
}
