/**
 * T-405 — the website debt-aging canonical port suite.
 *
 * Pins:
 *   1. The port (`src/lib/canonical/calc/ledger/debt-aging.ts`) reproduces
 *      the desktop reference engine's two ARCHETYPE fixtures EXACTLY: the
 *      same 100 000 DZD debt from 2024-2025, one parent paying monthly
 *      through 2025-2026 → GREEN/active_payer, the other silent since
 *      Nov 2024 → RED/critical_delinquency. Identical facts, opposite
 *      statuses — the T-405 contract.
 *   2. The row-level wrapper (`parentDebtAgingFromRows`) maps the portal's
 *      DB wire rows (snake_case InstallmentRow / LedgerEntryRow) through
 *      the same canonical engine — the outstanding equals Σ
 *      installmentRemainingAmount (the §15 basis — the same amount the
 *      staff Suivi des Dettes tab shows).
 *   3. The status thresholds (§15.1) — the ordered INV-16 evaluation with
 *      the 60/90/180 boundaries.
 *   4. Year attribution (INV-14) — row window beats the convention.
 */
import { describe, it, expect } from "vitest";
import {
  computeDebtAgingAnalysis,
  computeDebtAgingStatus,
  resolveAcademicYearForDate,
  DEBT_AGING_ACTIVE_PAYER_WINDOW_DAYS,
  DEBT_AGING_SUSTAINED_DAYS,
  DEBT_AGING_CRITICAL_DAYS,
  DEBT_AGING_EPSILON_DZD,
  type DebtAgingAnalysis,
} from "./calc/ledger/debt-aging";
import { parentDebtAgingFromRows, installmentRemainingAmount } from "./portal-derive";
import type { LedgerEntryRow, InstallmentRow } from "@/lib/types/database";
import type { LedgerEntry } from "./model/ledger";

/* ── Fixtures ───────────────────────────────────────────────────────────── */

const NOW = new Date("2026-06-15T12:00:00.000Z");
const P_A = "p-archetype-a";
const P_B = "p-archetype-b";

function canonicalInstallment(parentId: string, dueDate: string) {
  return {
    id: `ins-${parentId}`,
    parentId,
    studentId: `stu-${parentId}`,
    category: "tuition" as const,
    label: "Tranche 1",
    amountDue: 100_000,
    amountPaid: 0,
    amountPending: 0,
    dueDate,
    paidDate: null,
    status: "unpaid" as const,
  };
}

function paymentEntry(parentId: string, at: string, amount = -8_000): LedgerEntry {
  return {
    id: `led-${parentId}-${at}`,
    tenantId: "t1",
    accountId: `parent:${parentId}:category:tuition`,
    parentId,
    studentId: `stu-${parentId}`,
    category: "tuition",
    amount,
    type: "payment" as const,
    sourceType: "payment",
    sourceId: "pay-x",
    method: "cash",
    receiptNumber: null,
    paymentStatus: "paid",
    reversesId: null,
    description: "Encaissement",
    actorId: "usr-1",
    actorName: "Staff",
    at,
    metadata: {},
  };
}

/* ── The port equivalence (the two archetypes) ──────────────────────────── */

describe("T-405 port — the two archetype parents (desktop parity)", () => {
  it("Parent A: old debt + continued monthly payment → GREEN / active_payer", () => {
    const monthly = Array.from({ length: 10 }, (_, i) =>
      paymentEntry(P_A, new Date(2025, 8 + i, 5).toISOString()),
    );
    const a: DebtAgingAnalysis = computeDebtAgingAnalysis({
      parentId: P_A,
      installments: [canonicalInstallment(P_A, "2024-10-15")],
      ledgerEntries: monthly,
      academicYears: [],
      now: NOW,
    });
    expect(a.outstandingAmount).toBe(100_000);
    expect(a.originAcademicYear).toBe("2024-2025");
    expect(a.debtAgeDays).toBe(608);
    expect(a.inactivityDays).toBe(10);
    expect(a.subsequentYearPaymentCount).toBe(10);
    expect(a.subsequentYearPaymentTotal).toBe(80_000);
    expect(a.status.level).toBe("green");
    expect(a.status.reasonCode).toBe("active_payer");
  });

  it("Parent B: same debt, prolonged non-payment → RED / critical_delinquency", () => {
    const b: DebtAgingAnalysis = computeDebtAgingAnalysis({
      parentId: P_B,
      installments: [canonicalInstallment(P_B, "2024-10-15")],
      ledgerEntries: [paymentEntry(P_B, "2024-11-01T10:00:00.000Z", -20_000)],
      academicYears: [],
      now: NOW,
    });
    expect(b.outstandingAmount).toBe(100_000);
    expect(b.debtAgeDays).toBe(608);
    expect(b.inactivityDays).toBe(591);
    expect(b.subsequentYearPaymentCount).toBe(0);
    expect(b.status.level).toBe("red");
    expect(b.status.reasonCode).toBe("critical_delinquency");
  });
});

/* ── The row-level wrapper (the portal DB wire shapes) ──────────────────── */

function wireInstallment(parentId: string, dueDate: string, over: Partial<InstallmentRow> = {}): InstallmentRow {
  return {
    id: `ins-${parentId}`,
    tenant_id: "t1",
    parent_id: parentId,
    student_id: `stu-${parentId}`,
    service_enrollment_id: "se-1",
    invoice_id: null,
    tranche_number: 1,
    amount_due: 100000,
    amount_paid: 0,
    amount_pending: 0,
    due_date: dueDate,
    paid_date: null,
    status: "unpaid",
    academic_cycle: null,
    payment_plan: "tranches",
    is_custom_schedule: false,
    custom_schedule_note: null,
    label: "Tranche 1",
    category: "tuition",
    created_at: "2024-10-01T00:00:00Z",
    updated_at: "2024-10-01T00:00:00Z",
    ...over,
  } as InstallmentRow;
}

function wireLedger(parentId: string, at: string, amount: number): LedgerEntryRow {
  return {
    id: `led-${parentId}-${at}`,
    entry_number: `LED-${at}`,
    tenant_id: "t1",
    account_id: `parent:${parentId}:category:tuition`,
    parent_id: parentId,
    student_id: `stu-${parentId}`,
    category: "tuition",
    amount,
    entry_type: "payment",
    source_type: "payment",
    source_id: "pay-x",
    method: "cash",
    receipt_number: null,
    payment_status: "paid",
    reverses_id: null,
    description: "Encaissement",
    actor_id: "usr-1",
    actor_name: "Staff",
    at,
    metadata: {},
    created_at: at,
  } as unknown as LedgerEntryRow;
}

describe("T-405 — parentDebtAgingFromRows (the portal wrapper)", () => {
  it("maps the wire rows through the canonical engine with the §15 outstanding", () => {
    const installments = [
      wireInstallment(P_A, "2024-10-15"),
      // A pending uncleared tranche (its pending funds reduce the §15 basis).
      wireInstallment(P_A, "2026-03-15", {
        id: "ins-a-2",
        amount_due: 60000,
        amount_paid: 30000,
        amount_pending: 20000,
        status: "partial",
      }),
    ];
    const ledger = [
      wireLedger(P_A, "2024-11-01T10:00:00Z", -10_000),
      wireLedger(P_A, "2026-06-10T10:00:00Z", -40_000),
    ];
    const a = parentDebtAgingFromRows(installments, ledger, { parentId: P_A, now: NOW });

    // §15 outstanding == Σ installmentRemainingAmount over unpaid rows
    // (60_000−30_000−20_000 = 10_000 + 100_000 = 110_000) — the same basis
    // the staff Suivi des Dettes tab shows.
    const expected = installments.reduce((s, i) => s + installmentRemainingAmount(i), 0);
    expect(a.outstandingAmount).toBe(expected);
    expect(a.outstandingAmount).toBe(110_000);

    // The behavior facts: last payment 5 days ago → active.
    expect(a.inactivityDays).toBe(5);
    expect(a.status.level).toBe("green");
    expect(a.status.reasonCode).toBe("active_payer");
    // Origin year from the OLDEST outstanding due date.
    expect(a.originAcademicYear).toBe("2024-2025");
    // The 2026 payment is subsequent-year activity (> 2024-2025).
    expect(a.subsequentYearPaymentCount).toBe(1);
    expect(a.subsequentYearPaymentTotal).toBe(40_000);
  });

  it("a resolved family yields the resolved status (outstanding ≤ epsilon)", () => {
    const installments = [
      wireInstallment(P_A, "2024-10-15", { amount_paid: 100000, status: "paid" }),
    ];
    const a = parentDebtAgingFromRows(installments, [], { parentId: P_A, now: NOW });
    expect(a.outstandingAmount).toBe(0);
    expect(a.status.reasonCode).toBe("resolved");
    expect(a.status.level).toBe("green");
  });
});

/* ── The canonical thresholds (§15.1) ───────────────────────────────────── */

describe("T-405 port — the ordered status evaluation", () => {
  it("rule order: a payment within 60 days dominates an ancient balance", () => {
    const s = computeDebtAgingStatus({ outstandingAmount: 150_000, debtAgeDays: 730, inactivityDays: 30 });
    expect(s.level).toBe("green");
    expect(s.reasonCode).toBe("active_payer");
  });

  it("the 60/90/180 boundaries", () => {
    expect(computeDebtAgingStatus({ outstandingAmount: 1, debtAgeDays: 900, inactivityDays: 60 }).reasonCode).toBe("active_payer");
    expect(computeDebtAgingStatus({ outstandingAmount: 1, debtAgeDays: 900, inactivityDays: 61 }).level).toBe("orange");
    expect(computeDebtAgingStatus({ outstandingAmount: 1, debtAgeDays: 181, inactivityDays: 181 }).level).toBe("red");
    expect(computeDebtAgingStatus({ outstandingAmount: 1, debtAgeDays: 180, inactivityDays: 400 }).level).not.toBe("red");
    expect(computeDebtAgingStatus({ outstandingAmount: 1, debtAgeDays: 70, inactivityDays: 70 }).level).toBe("yellow");
    expect(computeDebtAgingStatus({ outstandingAmount: 0, debtAgeDays: 500, inactivityDays: 500 }).reasonCode).toBe("resolved");
  });

  it("the threshold constants match the documented aging-bucket edges", () => {
    expect(DEBT_AGING_ACTIVE_PAYER_WINDOW_DAYS).toBe(60);
    expect(DEBT_AGING_SUSTAINED_DAYS).toBe(90);
    expect(DEBT_AGING_CRITICAL_DAYS).toBe(180);
    expect(DEBT_AGING_EPSILON_DZD).toBe(0.001);
  });
});

/* ── INV-14 attribution ─────────────────────────────────────────────────── */

describe("T-405 port — academic-year attribution", () => {
  it("row window beats the calendar convention; convention applies outside", () => {
    const years = [
      { code: "2024-2025", startDate: "2024-08-01", endDate: "2025-08-31" },
    ];
    expect(resolveAcademicYearForDate("2025-08-15", years)).toBe("2024-2025");
    expect(resolveAcademicYearForDate("2025-09-15", years)).toBe("2025-2026");
    expect(resolveAcademicYearForDate("2024-10-15", [])).toBe("2024-2025");
    expect(resolveAcademicYearForDate("2026-02-10", [])).toBe("2025-2026");
  });
});
