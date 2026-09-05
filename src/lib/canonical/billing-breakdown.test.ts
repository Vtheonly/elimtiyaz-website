/**
 * billing-breakdown.ts — website canonical derivation tests (T-166).
 *
 * These mirror the desktop engine's suite
 * (hub: src/tests/domain/payment/billing-breakdown.test.ts, T-164) so both
 * platforms are verified against the SAME vectors:
 *   - the owner-reported 285 000 / 125 000 headline scenario,
 *   - per-child attribution + per-service consolidation,
 *   - INV-4 remaining semantics on REAL installment rows,
 *   - adjustment credit/debit badge + diagnostic fallback wording.
 *
 * The portal does NOT synthesize tranches (ADR-002 / T-057: write-path and
 * pricing logic lives server-side) — physical rows are rendered verbatim,
 * which these tests pin.
 */
import { describe, expect, it } from "vitest";
import {
  parentBillingBreakdown,
  describeAdjustment,
  classifyAdjustmentRows,
  resolveBillingAcademicYear,
  serviceLabelOf,
} from "@/lib/canonical/billing-breakdown";
import type { LedgerEntryRow, InstallmentRow, StudentRow } from "@/lib/types/database";

function ledgerRow(overrides: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: null,
    entry_number: "led-test-1",
    tenant_id: "t1",
    account_id: "parent:p1:category:tuition",
    parent_id: "p1",
    student_id: "s1",
    category: "tuition",
    amount: 285000,
    entry_type: "charge",
    source_type: "bulk_import",
    source_id: "run-1",
    method: null,
    receipt_number: null,
    payment_status: null,
    reverses_id: null,
    description: "Devis annuel (import Excel run run-1)",
    actor_id: "u1",
    actor_name: "Test",
    at: "2025-08-11T22:22:37Z",
    metadata: {},
    created_at: "2025-08-11T22:22:37Z",
    ...overrides,
  };
}

function installmentRow(overrides: Partial<InstallmentRow>): InstallmentRow {
  return {
    id: "ins-1",
    tenant_id: "t1",
    parent_id: "p1",
    student_id: "s1",
    service_enrollment_id: null as unknown as string,
    invoice_id: null,
    category: "tuition",
    tranche_number: 1,
    label: "Tranche 1 — Scolarité",
    amount_due: 114000,
    amount_paid: 0,
    amount_pending: 0,
    due_date: "2025-09-15",
    paid_date: null,
    status: "unpaid",
    academic_cycle: null,
    payment_plan: "tranches",
    is_custom_schedule: false,
    custom_schedule_note: null,
    created_at: "2025-08-11T22:22:37Z",
    updated_at: "2025-08-11T22:22:37Z",
    ...overrides,
  };
}

function kid(overrides: Partial<StudentRow>): StudentRow {
  return {
    id: "s1",
    tenant_id: "t1",
    parent_id: "p1",
    student_code: "ELV-000001",
    first_name: "Sara",
    middle_name: null,
    last_name: "BENALI",
    date_of_birth: "2015-04-02",
    gender: "female",
    grade_level_id: null,
    class_id: null,
    enrollment_date: "2025-09-01",
    enrollment_status: "active",
    medical_notes: null,
    is_active: true,
    auth_user_id: null,
    created_at: "2025-09-01T00:00:00Z",
    updated_at: "2025-09-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("parentBillingBreakdown — headline parity scenario", () => {
  it("itemizes the 285 000 charge per child with the real tranche rows", () => {
    const breakdown = parentBillingBreakdown(
      [ledgerRow({ amount: 285000 })],
      [
        installmentRow({ id: "i1", tranche_number: 1, amount_due: 114000, amount_paid: 100000, status: "partial" }),
        installmentRow({ id: "i2", tranche_number: 2, label: "Tranche 2 — Scolarité", amount_due: 85500, due_date: "2025-12-15" }),
        installmentRow({ id: "i3", tranche_number: 3, label: "Tranche 3 — Scolarité", amount_due: 85500, due_date: "2026-03-15" }),
      ],
      [kid({})],
    );

    expect(breakdown.totalBilled).toBe(285000);
    expect(breakdown.byChild).toHaveLength(1);
    const child = breakdown.byChild[0];
    expect(child.displayName).toBe("Sara BENALI");
    expect(child.billedTotal).toBe(285000);
    expect(child.lineItems).toHaveLength(1);
    expect(child.lineItems[0].label).toBe("Devis annuel (import Excel run run-1)");

    // REAL tranche coverage — rendered verbatim, INV-4 remaining.
    expect(child.tranches).toHaveLength(3);
    expect(child.tranches[0].amountPaid).toBe(100000);
    expect(child.tranches[0].remaining).toBe(14000);
    expect(child.tranches[1].remaining).toBe(85500);
    expect(child.tranches[2].remaining).toBe(85500);
    // Σ remaining === ledger outstanding: 285 000 − 100 000.
    expect(child.tranches.reduce((s, t) => s + t.remaining, 0)).toBe(185000);
  });

  it("renders NO tranches when none exist (portal never synthesizes — ADR-002)", () => {
    const breakdown = parentBillingBreakdown([ledgerRow({ amount: 285000 })], [], [kid({})]);
    expect(breakdown.byChild[0].tranches).toHaveLength(0);
    expect(breakdown.totalBilled).toBe(285000);
    expect(breakdown.byChild[0].billedTotal).toBe(285000);
  });

  it("honours INV-4: remaining subtracts pending funds", () => {
    const breakdown = parentBillingBreakdown(
      [ledgerRow({ amount: 114000 })],
      [installmentRow({ amount_due: 114000, amount_paid: 40000, amount_pending: 30000 })],
      [kid({})],
    );
    expect(breakdown.byChild[0].tranches[0].remaining).toBe(44000);
  });

  it("sorts tranches chronologically by due date", () => {
    const breakdown = parentBillingBreakdown(
      [ledgerRow({ amount: 200000 })],
      [
        installmentRow({ id: "late", tranche_number: 3, due_date: "2026-03-15", amount_due: 50000 }),
        installmentRow({ id: "early", tranche_number: 1, due_date: "2025-09-15", amount_due: 150000 }),
      ],
      [kid({})],
    );
    expect(breakdown.byChild[0].tranches.map((t) => t.installmentId)).toEqual(["early", "late"]);
  });
});

describe("parentBillingBreakdown — multi-child + services", () => {
  it("attributes charges per child via student_id and consolidates per service", () => {
    const breakdown = parentBillingBreakdown(
      [
        ledgerRow({ entry_number: "c-a", student_id: "s-a", amount: 200000, category: "tuition" }),
        ledgerRow({ entry_number: "c-b", student_id: "s-b", amount: 30000, category: "transport" }),
      ],
      [installmentRow({ student_id: "s-a", amount_due: 200000, amount_paid: 200000, status: "paid" })],
      [kid({ id: "s-a", first_name: "A" }), kid({ id: "s-b", first_name: "B" })],
    );

    expect(breakdown.byChild.map((c) => c.billedTotal)).toEqual([200000, 30000]);
    expect(breakdown.byService.map((s) => s.category)).toEqual(["tuition", "transport"]);
    expect(breakdown.byService[0].amount).toBe(200000);
    expect(breakdown.byService[1].amount).toBe(30000);
    // Per-service labels use the canonical FR wording (desktop parity).
    expect(breakdown.byService[0].label).toBe("Scolarité");
    expect(breakdown.byService[1].label).toBe("Transport");
  });

  it("single-child family inherits family-scoped (null student) charges", () => {
    const breakdown = parentBillingBreakdown(
      [ledgerRow({ student_id: null, amount: 150000 })],
      [installmentRow({ student_id: null as unknown as string, amount_due: 150000, amount_paid: 50000, status: "partial" })],
      [kid({})],
    );
    expect(breakdown.byChild[0].billedTotal).toBe(150000);
    expect(breakdown.byChild[0].tranches[0].amountPaid).toBe(50000);
  });
});

describe("academic year + labels", () => {
  it("resolves from charge metadata, then description, then the default", () => {
    expect(resolveBillingAcademicYear([ledgerRow({ metadata: { academicYear: "2026-2027" } })])).toBe("2026-2027");
    expect(resolveBillingAcademicYear([ledgerRow({ description: "Scolarité 2025-2026 (import)" })])).toBe("2025-2026");
    expect(resolveBillingAcademicYear([ledgerRow({ entry_type: "payment", description: "Versement" })])).toBe("2025-2026");
  });

  it("maps wire categories to the canonical FR service labels", () => {
    expect(serviceLabelOf("tuition")).toBe("Scolarité");
    expect(serviceLabelOf("transport")).toBe("Transport");
    expect(serviceLabelOf(null)).toBe("Autres prestations");
    expect(serviceLabelOf("unknown_code")).toBe("Autres prestations");
  });
});

describe("describeAdjustment — cross-platform diagnostics", () => {
  it("labels negative as credit with the stored reason", () => {
    const diag = describeAdjustment(ledgerRow({ entry_type: "adjustment", amount: -71000, description: "Remise fratrie (3 enfants)" }));
    expect(diag.kind).toBe("credit");
    expect(diag.badgeLabel).toBe("Crédit / Déduction");
    expect(diag.reasonLabel).toBe("Remise fratrie (3 enfants)");
    expect(diag.isDiagnosticFallback).toBe(false);
  });

  it("labels positive as debit (majoration)", () => {
    const diag = describeAdjustment(ledgerRow({ entry_type: "adjustment", amount: 71000, description: "Annulation de remise lors du ré-import" }));
    expect(diag.kind).toBe("debit");
    expect(diag.badgeLabel).toBe("Débit / Majoration");
  });

  it("substitutes the shared diagnostic when the description is blank (same wording as desktop)", () => {
    const credit = describeAdjustment(ledgerRow({ entry_type: "adjustment", amount: -50000, description: "   " }));
    expect(credit.isDiagnosticFallback).toBe(true);
    expect(credit.reasonLabel).toBe(
      "Déduction / remise enregistrée automatiquement par le système (motif non documenté)",
    );
    const debit = describeAdjustment(ledgerRow({ entry_type: "adjustment", amount: 50000, description: "" }));
    expect(debit.reasonLabel).toBe(
      "Régularisation / rétablissement de dette (contrepassation automatique, motif non documenté)",
    );
  });
});

/* ============================================================ */
/*  T-168 — parity corpus (identical vectors to the desktop)     */
/* ============================================================ */

describe("parentBillingBreakdown — T-168 complete itemized shopping list", () => {
  const kids2 = [
    kid({ id: "s1", first_name: "Sara", last_name: "BENALI" }),
    kid({ id: "s2", first_name: "Yanis", last_name: "BENALI" }),
  ];
  const charges = [
    ledgerRow({ entry_number: "c-t1", student_id: "s1", amount: 285000, category: "tuition" }),
    ledgerRow({ entry_number: "c-t2", student_id: "s2", amount: 285000, category: "tuition" }),
    ledgerRow({ entry_number: "c-tr1", student_id: "s1", amount: 45000, category: "transport" }),
    ledgerRow({ entry_number: "c-tr2", student_id: "s2", amount: 45000, category: "transport" }),
    ledgerRow({
      entry_number: "c-ins",
      student_id: null,
      amount: 40000,
      category: "other",
      description: "Frais d'inscription (family-level)",
    }),
  ];

  it("accounts for every dinar: Σ byChild + unattributed === totalBilled (700 000)", () => {
    const breakdown = parentBillingBreakdown(charges, [], kids2);
    expect(breakdown.totalBilled).toBe(700000);
    expect(breakdown.byChild.map((c) => c.billedTotal)).toEqual([330000, 330000]);
    expect(breakdown.unattributedTotal).toBe(40000);
    expect(
      breakdown.byChild.reduce((s, c) => s + c.billedTotal, 0) + breakdown.unattributedTotal,
    ).toBe(breakdown.totalBilled);
  });

  it("consolidates per service with share % + child attribution (same numbers as desktop)", () => {
    const breakdown = parentBillingBreakdown(charges, [], kids2);
    const tuition = breakdown.byService.find((s) => s.category === "tuition")!;
    const transport = breakdown.byService.find((s) => s.category === "transport")!;
    const other = breakdown.byService.find((s) => s.category === "other")!;
    expect(tuition.amount).toBe(570000);
    expect(tuition.sharePct).toBe(81);
    expect(tuition.childAttribution).toEqual([
      { studentId: "s1", studentName: "Sara BENALI", amount: 285000 },
      { studentId: "s2", studentName: "Yanis BENALI", amount: 285000 },
    ]);
    expect(transport.amount).toBe(90000);
    expect(transport.sharePct).toBe(13);
    expect(other.amount).toBe(40000);
    expect(other.childAttribution).toEqual([
      { studentId: null, studentName: "Famille", amount: 40000 },
    ]);
    expect(breakdown.byService.reduce((s, x) => s + x.sharePct, 0)).toBe(100);
  });

  it("folds family-level charges into the single child of a single-child family", () => {
    const breakdown = parentBillingBreakdown(
      [
        ledgerRow({ entry_number: "c-t", student_id: "s1", amount: 285000, category: "tuition" }),
        ledgerRow({ entry_number: "c-ins", student_id: null, amount: 40000, category: "other" }),
      ],
      [],
      [kids2[0]],
    );
    expect(breakdown.byChild[0].billedTotal).toBe(325000);
    expect(breakdown.unattributedItems).toEqual([]);
  });
});

describe("parentBillingBreakdown — T-168 adjustment-aware reconciliation", () => {
  it("derives the full equation and balances to the server balance", () => {
    const breakdown = parentBillingBreakdown(
      [ledgerRow({ amount: 285000 })],
      [],
      [kid({})],
      {
        adjustmentRows: [
          ledgerRow({ entry_type: "adjustment", entry_number: "adj-1", amount: -71000, description: "Remise fratrie" }),
          ledgerRow({ entry_type: "adjustment", entry_number: "adj-2", amount: 20000, description: "Majoration transport" }),
        ],
        clearedPaid: 95000,
        pendingPaid: 30000,
        serverOutstanding: 109000,
      },
    );
    const r = breakdown.reconciliation;
    expect(r.grossBilled).toBe(285000);
    expect(r.adjustmentsCredit).toBe(71000);
    expect(r.adjustmentsDebit).toBe(20000);
    expect(r.netDue).toBe(234000);
    expect(r.clearedPaid).toBe(95000);
    expect(r.pendingPaid).toBe(30000);
    expect(r.derivedRemaining).toBe(109000);
    expect(r.serverOutstanding).toBe(109000);
    expect(r.bridge).toBe(0);
    expect(r.hasBridge).toBe(false);
  });

  it("surfaces the bridge when the server balance has invisible items", () => {
    const breakdown = parentBillingBreakdown([ledgerRow({ amount: 285000 })], [], [kid({})], {
      clearedPaid: 125000,
      serverOutstanding: 79000, // 10 000 refund server-side only
    });
    const r = breakdown.reconciliation;
    expect(r.derivedRemaining).toBe(160000);
    expect(r.bridge).toBe(-81000);
    expect(r.hasBridge).toBe(true);
  });
});

describe("classifyAdjustmentRows — provenance classification (T-168 parity)", () => {
  it("detects the owner's +X/−X re-import flip-flop as reversal pairs (order-independent)", () => {
    const classified = classifyAdjustmentRows([
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-c1", amount: 50000, description: "", at: "2025-09-05T09:00:00Z" }),
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-d2", amount: -71000, description: "", at: "2025-09-06T09:00:00Z" }),
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-d1", amount: 71000, description: "", at: "2025-09-05T10:00:00Z" }),
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-c2", amount: -50000, description: "", at: "2025-09-06T10:00:00Z" }),
    ]);
    const byId = new Map(classified.map((c) => [c.id, c]));
    expect(byId.get("adj-d1")!.pairedWithId).toBe("adj-d2");
    expect(byId.get("adj-d2")!.pairedWithId).toBe("adj-d1");
    expect(byId.get("adj-c1")!.pairedWithId).toBe("adj-c2");
    expect(byId.get("adj-c2")!.pairedWithId).toBe("adj-c1");
    for (const c of classified) {
      expect(c.provenance).toBe("reversal_pair");
      expect(c.provenanceLabel).toBe("Contrepassation");
      expect(c.meaningLabel).toContain("nul");
    }
  });

  it("classifies documented rows as actual content and blank rows as undocumented", () => {
    const [doc] = classifyAdjustmentRows([
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-1", amount: -71000, description: "Remise fratrie (3 enfants)" }),
    ]);
    expect(doc.provenance).toBe("documented");
    expect(doc.provenanceLabel).toBe("Documenté");
    expect(doc.meaningLabel).toContain("réduit le solde dû");

    const [blank] = classifyAdjustmentRows([
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-2", amount: -50000, description: "   " }),
    ]);
    expect(blank.provenance).toBe("undocumented");
    expect(blank.meaningLabel).toContain("auditer");
  });

  it("never pairs two same-sign entries and skips zero-amount rows", () => {
    const classified = classifyAdjustmentRows([
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-a", amount: 50000, description: "Note A", at: "2025-09-01T09:00:00Z" }),
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-b", amount: 50000, description: "Note B", at: "2025-09-02T09:00:00Z" }),
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-c", amount: -50000, description: "Remise", at: "2025-09-03T09:00:00Z" }),
      ledgerRow({ entry_type: "adjustment", entry_number: "adj-z", amount: 0, description: "", at: "2025-09-04T09:00:00Z" }),
    ]);
    const byId = new Map(classified.map((c) => [c.id, c]));
    expect(byId.get("adj-a")!.provenance).toBe("reversal_pair");
    expect(byId.get("adj-b")!.provenance).toBe("documented");
    expect(byId.get("adj-b")!.pairedWithId).toBeNull();
    expect(byId.get("adj-z")!.pairedWithId).toBeNull();
  });
});
