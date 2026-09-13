/**
 * T-330 — payment-coverage derivation parity tests.
 *
 * The owner mandate (58th session): "This must use the exact same
 * calculation and allocation logic as the desktop application… The same
 * inputs should produce the same results on both platforms."
 *
 * These tests pin the canonical chain implemented in
 * `src/lib/canonical/payment-coverage.ts` (ported from the desktop's
 * PaymentBreakdownCard):
 *
 *   1. payment_allocations rows win when present (the server-side waterfall
 *      record — migration 0033).
 *   2. Legacy payments with no rows fall back to the LEDGER derivation:
 *      payment-type entries sharing the payment's receipt number, amount =
 *      |entry.amount|, label = metadata.field.
 *   3. A payment with neither yields the single-category line
 *      { category, amount } — the desktop's final fallback.
 *
 * The fixtures mirror the desktop's receipt-number join semantics exactly
 * (see elimtiyaz-desktop payment-breakdown-card.tsx — the effect of each
 * branch is byte-identical).
 */
import { describe, it, expect } from "vitest";
import {
  allocationRowsToLines,
  deriveAllocationsFromLedger,
  paymentCoverageLines,
} from "@/lib/canonical/payment-coverage";
import type { LedgerEntryRow, PaymentAllocationRow, PaymentRow } from "@/lib/types/database";

const payment = (over: Partial<PaymentRow> = {}): PaymentRow =>
  ({
    id: "pay-1",
    tenant_id: "t1",
    parent_id: "par-1",
    student_id: null,
    amount: 300000,
    method: "cash",
    category: "tuition",
    status: "paid",
    collected_at: "2026-09-01T10:00:00Z",
    payment_number: "PAY-2026-001",
    receipt_number: "REC-2026-001",
    expected_amount: 250000,
    excess_amount: 50000,
    excess_remark: null,
    proof_path: null,
    check_number: null,
    check_bank: null,
    wire_reference: null,
    notes: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...over,
  }) as PaymentRow;

const ledgerEntry = (over: Partial<LedgerEntryRow> = {}): LedgerEntryRow =>
  ({
    id: "le-1",
    entry_number: "E-1",
    tenant_id: "t1",
    account_id: "acc-1",
    parent_id: "par-1",
    student_id: null,
    category: "tuition",
    amount: -250000,
    entry_type: "payment",
    source_type: null,
    source_id: null,
    method: "cash",
    receipt_number: "REC-2026-001",
    payment_status: "paid",
    reverses_id: null,
    description: null,
    actor_id: null,
    actor_name: null,
    at: "2026-09-01T10:00:00Z",
    metadata: { field: "Scolarité T1" },
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  }) as LedgerEntryRow;

const allocRow = (over: Partial<PaymentAllocationRow> = {}): PaymentAllocationRow =>
  ({
    id: "al-1",
    tenant_id: "t1",
    payment_id: "pay-1",
    charge_id: null,
    installment_id: "inst-1",
    category: "tuition",
    allocated_amount: 250000,
    label: "INSCRIPTION (FI)",
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  }) as PaymentAllocationRow;

describe("T-330 — desktop-parity ledger derivation (branch 2)", () => {
  it("payment-type entries sharing the receipt number become coverage lines (|amount|, metadata.field label)", () => {
    const entries = [
      ledgerEntry(),
      ledgerEntry({
        id: "le-2",
        entry_number: "E-2",
        category: "transport",
        amount: -50000,
        receipt_number: "REC-2026-001",
        metadata: { field: "Transport Alger" },
      }),
      // Non-matching: different receipt.
      ledgerEntry({ id: "le-3", entry_number: "E-3", receipt_number: "REC-OTHER" }),
      // Non-matching: not a payment entry.
      ledgerEntry({ id: "le-4", entry_number: "E-4", entry_type: "charge", amount: 250000 }),
    ];
    const lines = deriveAllocationsFromLedger(payment(), entries);
    expect(lines).toEqual([
      { key: "pay-1-le-1", category: "tuition", amount: 250000, label: "Scolarité T1" },
      { key: "pay-1-le-2", category: "transport", amount: 50000, label: "Transport Alger" },
    ]);
  });

  it("falls back to payment_number when receipt_number is null (the display rule)", () => {
    const entries = [
      ledgerEntry({ receipt_number: null, metadata: { field: "Affectation globale" } }),
    ];
    // The LEDGER side keys on its own receipt_number; a null receipt on the
    // payment falls to payment_number — here the ledger row also has null,
    // so no match: null !== "PAY-2026-001".
    expect(deriveAllocationsFromLedger(payment({ receipt_number: null }), entries)).toEqual([]);
    // With the ledger row carrying the payment number AS its receipt, it matches.
    expect(
      deriveAllocationsFromLedger(
        payment({ receipt_number: null }),
        [ledgerEntry({ receipt_number: "PAY-2026-001", metadata: { field: "Affectation globale" } })],
      ),
    ).toEqual([
      { key: "pay-1-le-1", category: "tuition", amount: 250000, label: "Affectation globale" },
    ]);
  });

  it("a payment with no receipt key at all derives nothing", () => {
    expect(
      deriveAllocationsFromLedger(
        payment({ receipt_number: null, payment_number: "" }),
        [ledgerEntry()],
      ),
    ).toEqual([]);
  });

  it("non-string / missing metadata.field renders a null label (desktop semantics)", () => {
    const lines = deriveAllocationsFromLedger(
      payment(),
      [
        ledgerEntry({ metadata: null }),
        ledgerEntry({ metadata: { field: 42 } }),
        ledgerEntry({ metadata: { other: "x" } }),
      ],
    );
    expect(lines.map((l) => l.label)).toEqual([null, null, null]);
  });
});

describe("T-330 — table rows → lines (branch 1)", () => {
  it("maps every row preserving order, label and amount", () => {
    const lines = allocationRowsToLines([
      allocRow(),
      allocRow({ id: "al-2", category: "transport", allocated_amount: 50000, label: null }),
    ]);
    expect(lines).toEqual([
      { key: "al-1", category: "tuition", amount: 250000, label: "INSCRIPTION (FI)" },
      { key: "al-2", category: "transport", amount: 50000, label: null },
    ]);
  });
});

describe("T-330 — the full precedence chain (1 → 2 → 3)", () => {
  it("branch 1: allocation rows win over the ledger derivation", () => {
    const lines = paymentCoverageLines(
      payment(),
      [allocRow(), allocRow({ id: "al-2", category: "transport", allocated_amount: 50000 })],
      [ledgerEntry()],
    );
    expect(lines.map((l) => l.key)).toEqual(["al-1", "al-2"]);
  });

  it("branch 2: no rows → ledger derivation", () => {
    const lines = paymentCoverageLines(payment(), [], [
      ledgerEntry(),
      ledgerEntry({ id: "le-2", entry_number: "E-2", category: "transport", amount: -50000 }),
    ]);
    expect(lines.map((l) => l.category)).toEqual(["tuition", "transport"]);
    expect(lines.map((l) => l.amount)).toEqual([250000, 50000]);
  });

  it("branch 3: neither → the single-category line (the desktop fallback)", () => {
    const lines = paymentCoverageLines(payment({ receipt_number: null, payment_number: "X" }), [], []);
    expect(lines).toEqual([
      { key: "pay-1-single", category: "tuition", amount: 300000, label: null },
    ]);
  });

  it("branch 3 with a null category renders the 'other' bucket", () => {
    const lines = paymentCoverageLines(payment({ category: null, receipt_number: null }), [], []);
    expect(lines[0].category).toBe("other");
  });

  it("DESKTOP PARITY PIN: the classic 300k split payment (250k tuition + 50k transport)", () => {
    // The exact scenario from migration 0033's design comment: "A 300000
    // payment can be split: 250000 to tuition charge, 50000 to transport
    // charge." Both platforms must produce the same two lines.
    const viaTable = paymentCoverageLines(
      payment(),
      [
        allocRow({ allocated_amount: 250000, label: "Scolarité" }),
        allocRow({ id: "al-2", category: "transport", allocated_amount: 50000, label: "Transport" }),
      ],
      [],
    );
    const viaLedger = paymentCoverageLines(payment(), [], [
      ledgerEntry({ amount: -250000, metadata: { field: "Scolarité" } }),
      ledgerEntry({
        id: "le-2",
        entry_number: "E-2",
        category: "transport",
        amount: -50000,
        receipt_number: "REC-2026-001",
        metadata: { field: "Transport" },
      }),
    ]);
    expect(viaTable.map((l) => [l.category, l.amount, l.label])).toEqual(
      viaLedger.map((l) => [l.category, l.amount, l.label]),
    );
    expect(viaTable.map((l) => [l.category, l.amount, l.label])).toEqual([
      ["tuition", 250000, "Scolarité"],
      ["transport", 50000, "Transport"],
    ]);
  });
});
