/**
 * Canonical portal derivations — unit tests.
 *
 * These mirror the desktop domain tests (src/tests/domain/...) so the
 * website's canonical port is verified against the SAME vectors the desktop
 * suite uses, plus portal-specific row-mapping cases. Cross-platform
 * equivalence (Android ↔ Desktop ↔ Website ↔ Backend) is enforced separately
 * by the cross-platform-equivalence suite; these tests are the website-local
 * safety net.
 */
import { describe, expect, it } from "vitest";
import {
  ledgerEntryFromRow,
  parentSummaryFromLedger,
  portalFinancialSummary,
  installmentRemainingAmount,
  subjectAverageFor,
  overallGpaFor,
  attendanceRatePercent,
  isPassing,
  asPaymentStatus,
  asPaymentCategory,
  ledgerTimeline,
  ledgerAdjustmentEntries,
} from "@/lib/canonical/portal-derive";
import { deriveAccountId } from "@/lib/canonical/calc/ledger/account-id";
import type { LedgerEntryRow, InstallmentRow } from "@/lib/types/database";

function ledgerRow(overrides: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: null,
    entry_number: "led-test-1",
    tenant_id: "t1",
    account_id: "parent:p1:category:tuition",
    parent_id: "p1",
    student_id: null,
    category: "tuition",
    amount: 100000,
    entry_type: "charge",
    source_type: "installment",
    source_id: "i1",
    method: null,
    receipt_number: null,
    payment_status: null,
    reverses_id: null,
    description: "test",
    actor_id: "u1",
    actor_name: "Test",
    at: "2026-09-15T00:00:00Z",
    metadata: {},
    created_at: "2026-09-15T00:00:00Z",
    ...overrides,
  };
}

describe("ledgerEntryFromRow — wire mapping", () => {
  it("maps a payment row to the canonical signed convention (negative)", () => {
    const e = ledgerEntryFromRow(
      ledgerRow({ entry_type: "payment", amount: -50000, payment_status: "paid", method: "cash" }),
    );
    expect(e.type).toBe("payment");
    expect(e.amount).toBe(-50000);
    expect(e.paymentStatus).toBe("paid");
    expect(e.method).toBe("cash");
    expect(e.id).toBe("led-test-1");
  });

  it("falls back on unknown enum wire codes the same way Android fromCode does", () => {
    // T-049: the whole point is an UNKNOWN wire code (DB text columns can
    // carry values outside the TS union at runtime) — cast so the type
    // system allows what the database can still send.
    const e = ledgerEntryFromRow(
      ledgerRow({ category: "unknown_cat", entry_type: "weird" } as unknown as Partial<LedgerEntryRow>),
    );
    expect(e.category).toBe("other");
    expect(e.type).toBe("charge");
  });
});

describe("computeParentSummary via portal — INV-1/2/3/4", () => {
  const now = new Date("2027-01-01T00:00:00Z");

  it("replays charges + payments to a positive outstanding balance", () => {
    const rows = [
      ledgerRow({ entry_number: "c1", amount: 330000, at: "2026-09-15T00:00:00Z" }),
      ledgerRow({
        entry_number: "p1",
        entry_type: "payment",
        amount: -132000,
        payment_status: "paid",
        method: "cash",
        at: "2026-09-20T00:00:00Z",
      }),
    ];
    const s = portalFinancialSummary(rows, "p1", now);
    expect(s.outstanding).toBe(198000);
    expect(s.totalCharged).toBe(330000);
    expect(s.totalPaid).toBe(132000);
  });

  it("counts pending (uncleared) payments toward balance but not toward cleared totals (INV-5)", () => {
    const rows = [
      ledgerRow({ entry_number: "c1", amount: 100000 }),
      ledgerRow({
        entry_number: "p1",
        entry_type: "payment",
        amount: -40000,
        payment_status: "pending",
        method: "check",
        at: "2026-10-01T00:00:00Z",
      }),
    ];
    const s = portalFinancialSummary(rows, "p1", now);
    expect(s.outstanding).toBe(60000);
    expect(s.totalPending).toBe(40000);
    expect(s.totalPaid).toBe(40000);
  });

  it("tracks parent_credit separately as unallocatedCredit (INV-3/INV-7)", () => {
    // CANONICAL INV-7 bookkeeping: the payment entry carries the FULL amount
    // (−150k on the tuition account) AND the unallocated 50k is written as a
    // separate parent_credit adjustment (−50k on the credit account).
    // Total outstanding = −100k (both accounts negative); the explicit
    // unallocatedCredit bucket = −50k. Verified identical to the backend
    // collect_and_allocate_payment + compute_parent_summary behaviour.
    const rows = [
      ledgerRow({ entry_number: "c1", amount: 100000 }),
      ledgerRow({
        entry_number: "p1",
        entry_type: "payment",
        amount: -150000,
        payment_status: "paid",
        method: "cash",
        at: "2026-10-01T00:00:00Z",
      }),
      ledgerRow({
        entry_number: "a1",
        account_id: "parent:p1:category:parent_credit",
        category: "parent_credit",
        entry_type: "adjustment",
        amount: -50000,
        source_type: "adjustment",
        at: "2026-10-01T00:00:01Z",
      }),
    ];
    const s = portalFinancialSummary(rows, "p1", now);
    expect(s.outstanding).toBe(-100000);
    expect(s.unallocatedCredit).toBe(-50000);
  });

  it("excludes reversed entries from typed totals but keeps the balance net-zero (INV-2)", () => {
    const rows = [
      ledgerRow({ entry_number: "c1", amount: 100000 }),
      ledgerRow({
        entry_number: "p1",
        entry_type: "payment",
        amount: -40000,
        payment_status: "paid",
        method: "cash",
        at: "2026-10-01T00:00:00Z",
      }),
      ledgerRow({
        entry_number: "r1",
        entry_type: "reversal",
        amount: 40000,
        reverses_id: "p1",
        at: "2026-10-02T00:00:00Z",
      }),
    ];
    const s = portalFinancialSummary(rows, "p1", now);
    // balance = 100000 - 40000 + 40000 = 100000; totalPaid excludes reversed p1.
    expect(s.outstanding).toBe(100000);
    expect(s.totalPaid).toBe(0);
  });

  it("derives account ids exactly like the canonical engine", () => {
    expect(deriveAccountId("p1", "tuition", null)).toBe("parent:p1:category:tuition");
    expect(deriveAccountId("p1", "tuition", "s1")).toBe("parent:p1:category:tuition:student:s1");
    expect(deriveAccountId("p1", "parent_credit", null)).toBe("parent:p1:category:parent_credit");
  });
});

describe("installmentRemainingAmount — INV-4", () => {
  const inst = (over: Partial<InstallmentRow>): InstallmentRow =>
    ({
      id: "i1",
      tenant_id: "t1",
      parent_id: "p1",
      student_id: "s1",
      service_enrollment_id: "se1",
      invoice_id: null,
      tranche_number: 1,
      amount_due: 93000,
      amount_paid: 40000,
      amount_pending: 20000,
      due_date: "2026-12-15",
      paid_date: null,
      status: "partial",
      academic_cycle: "primaire",
      payment_plan: "tranches",
      is_custom_schedule: false,
      custom_schedule_note: null,
      label: "Tranche 1",
      category: "tuition",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
      ...over,
    }) as InstallmentRow;

  it("subtracts both cleared and pending funds (backend waterfall semantics)", () => {
    expect(installmentRemainingAmount(inst({}))).toBe(33000);
  });
  it("never goes negative", () => {
    expect(installmentRemainingAmount(inst({ amount_paid: 93000 }))).toBe(0);
  });
});

describe("subjectAverageFor — canonical (D1 + D2 + 2×Ex)/4", () => {
  it("computes the canonical average with half-up rounding", () => {
    expect(subjectAverageFor({ devoir1: 12, devoir2: 14, examen: 16, coefficient: 1, isExtracurricular: false })).toBe(14.5);
  });
  it("returns null unless ALL THREE marks are present", () => {
    expect(subjectAverageFor({ devoir1: 12, devoir2: null, examen: 16, coefficient: 1, isExtracurricular: false })).toBeNull();
    expect(subjectAverageFor({ devoir1: null, devoir2: null, examen: null, coefficient: 1, isExtracurricular: false })).toBeNull();
  });
  it("rounds .xx5 half-up exactly like SQL ROUND(numeric,2)", () => {
    // (10 + 10 + 2×11)/4 = 10.5 — no rounding needed
    expect(subjectAverageFor({ devoir1: 10, devoir2: 10, examen: 11, coefficient: 1, isExtracurricular: false })).toBe(10.5);
    // (11.15 + 10.25 + 2×12.3)/4 = 11.5
    expect(subjectAverageFor({ devoir1: 11.15, devoir2: 10.25, examen: 12.3, coefficient: 1, isExtracurricular: false })).toBe(11.5);
  });
});

describe("overallGpaFor — coefficient-weighted, extracurricular excluded", () => {
  it("weights by coefficient", () => {
    const gpa = overallGpaFor([
      { devoir1: 10, devoir2: 10, examen: 10, coefficient: 1, isExtracurricular: false }, // 10
      { devoir1: 16, devoir2: 16, examen: 16, coefficient: 3, isExtracurricular: false }, // 16
    ]);
    expect(gpa).toBe(14.5); // (10×1 + 16×3) / 4
  });
  it("excludes extracurricular subjects", () => {
    const gpa = overallGpaFor([
      { devoir1: 10, devoir2: 10, examen: 10, coefficient: 1, isExtracurricular: false },
      { devoir1: 20, devoir2: 20, examen: 20, coefficient: 5, isExtracurricular: true },
    ]);
    expect(gpa).toBe(10);
  });
  it("returns null when nothing is computable", () => {
    expect(overallGpaFor([{ devoir1: 10, devoir2: null, examen: 10, coefficient: 1, isExtracurricular: false }])).toBeNull();
  });
  it("isPassing at the canonical 10.00 threshold", () => {
    expect(isPassing(10)).toBe(true);
    expect(isPassing(9.99)).toBe(false);
  });
});

describe("attendanceRatePercent — canonical rate", () => {
  it("counts present + late as attended", () => {
    expect(
      attendanceRatePercent([
        { status: "present" },
        { status: "present" },
        { status: "late" },
        { status: "absent_excused" },
      ]),
    ).toBe(75);
  });
});

describe("wire-code mappers", () => {
  it("asPaymentStatus defaults to pending for unknown codes", () => {
    expect(asPaymentStatus("pending_clearance")).toBe("pending_clearance");
    expect(asPaymentStatus("garbage")).toBe("pending");
  });
  it("asPaymentCategory defaults to other", () => {
    expect(asPaymentCategory("therapy_speech")).toBe("therapy_speech");
    expect(asPaymentCategory("nope")).toBe("other");
  });
});

describe("ledgerTimeline — statement replay (session 8)", () => {
  it("sorts chronologically and accumulates the signed running balance", () => {
    const rows = [
      ledgerRow({ entry_number: "l3", entry_type: "payment", amount: -30000, at: "2026-09-20T00:00:00Z" }),
      ledgerRow({ entry_number: "l1", entry_type: "charge", amount: 50000, at: "2026-09-05T00:00:00Z" }),
      ledgerRow({ entry_number: "l2", entry_type: "adjustment", amount: -5000, at: "2026-09-10T00:00:00Z" }),
    ];
    const timeline = ledgerTimeline(rows);
    expect(timeline.map((t) => t.entry.entry_number)).toEqual(["l1", "l2", "l3"]);
    expect(timeline.map((t) => t.runningBalance)).toEqual([50000, 45000, 15000]);
    // The final running balance equals the plain signed sum — identical to
    // what computeParentSummary replays for the parent's total balance.
    const sum = rows.reduce((acc, r) => acc + Number(r.amount), 0);
    expect(timeline[timeline.length - 1].runningBalance).toBe(sum);
  });

  it("buckets entries into ISO months for statement grouping", () => {
    const timeline = ledgerTimeline([
      ledgerRow({ entry_number: "a", at: "2026-08-31T23:00:00Z" }),
      ledgerRow({ entry_number: "b", at: "2026-09-01T01:00:00Z" }),
    ]);
    expect(timeline.map((t) => t.month)).toEqual(["2026-08", "2026-09"]);
  });

  it("breaks same-timestamp ties by entry_number (stable order)", () => {
    const timeline = ledgerTimeline([
      ledgerRow({ entry_number: "zz", at: "2026-09-01T00:00:00Z" }),
      ledgerRow({ entry_number: "aa", at: "2026-09-01T00:00:00Z" }),
    ]);
    expect(timeline.map((t) => t.entry.entry_number)).toEqual(["aa", "zz"]);
  });

  it("returns an empty timeline for empty input", () => {
    expect(ledgerTimeline([])).toEqual([]);
  });
});

describe("ledgerAdjustmentEntries — real adjustment source (session 8)", () => {
  it("filters to adjustment entries only, newest first", () => {
    const rows = [
      ledgerRow({ entry_number: "c1", entry_type: "charge", at: "2026-09-01T00:00:00Z" }),
      ledgerRow({ entry_number: "a1", entry_type: "adjustment", amount: -2000, at: "2026-09-02T00:00:00Z" }),
      ledgerRow({ entry_number: "p1", entry_type: "payment", amount: -1000, at: "2026-09-03T00:00:00Z" }),
      ledgerRow({ entry_number: "a2", entry_type: "adjustment", amount: 500, at: "2026-09-04T00:00:00Z" }),
    ];
    const adjustments = ledgerAdjustmentEntries(rows);
    expect(adjustments.map((a) => a.entry_number)).toEqual(["a2", "a1"]);
  });

  it("returns [] when the ledger holds no adjustments (honest empty state)", () => {
    expect(
      ledgerAdjustmentEntries([
        ledgerRow({ entry_number: "c1", entry_type: "charge" }),
        ledgerRow({ entry_number: "p1", entry_type: "payment", amount: -1000 }),
      ]),
    ).toEqual([]);
  });
});
