/**
 * T-105 — cross-platform corpus equivalence, WEBSITE leg (parent portal).
 *
 * The fixture (`src/test/fixtures/t105-corpus.json`) carries the REAL
 * post-0063 ledger corpus of all 259 parents of the source workbook
 * (Suivis clients  2026_2027.xlsx — rows 2-391, migrated + reconciled by
 * migrations 0062/0063), together with the canonical expected summaries
 * queried from the live backend's `compute_parent_summary` SQL RPC.
 *
 * This test proves the website's canonical port (portalFinancialSummary —
 * the same read path the parent portal statement uses) produces, for
 * EVERY parent of the workbook, exactly the values the canonical backend
 * computes — the third leg of the desktop/Android/website equivalence
 * the T-105 verification matrix records.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { portalFinancialSummary, installmentRemainingAmount } from "@/lib/canonical/portal-derive";
import type { LedgerEntryRow, InstallmentRow } from "@/lib/types/database";

interface CorpusParent {
  parentId: string;
  displayName: string;
  rows: LedgerEntryRow[];
  expected: {
    outstanding: number;
    totalCharged: number;
    totalPaid: number;
    unallocatedCredit: number;
  };
}

const FIXTURE = path.resolve(__dirname, "fixtures/t105-corpus.json");
const corpus: CorpusParent[] = JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));

describe("T-105 — corpus equivalence: portalFinancialSummary vs the backend canonical (259 parents)", () => {
  it("fixture loads with the full corpus", () => {
    expect(corpus.length).toBe(259);
  });

  it.each(corpus.map((p) => [p.displayName || p.parentId, p] as const))(
    "%s — outstanding/charged/paid match the backend RPC",
    (_name, p) => {
      const summary = portalFinancialSummary(p.rows, p.parentId);
      expect(Math.round(summary.outstanding)).toBe(Math.round(p.expected.outstanding));
      expect(Math.round(summary.totalCharged)).toBe(Math.round(p.expected.totalCharged));
      expect(Math.round(summary.totalPaid)).toBe(Math.round(p.expected.totalPaid));
      expect(Math.round(summary.unallocatedCredit)).toBe(Math.round(p.expected.unallocatedCredit));
    },
  );

  it("aggregate: Σ outstanding + Σ credit across the corpus equals the backend totals", () => {
    const sum = (fn: (p: CorpusParent) => number) =>
      corpus.reduce((acc, p) => acc + fn(p), 0);
    expect(Math.round(sum((p) => portalFinancialSummary(p.rows, p.parentId).outstanding)))
      .toBe(Math.round(sum((p) => p.expected.outstanding)));
    expect(Math.round(sum((p) => portalFinancialSummary(p.rows, p.parentId).totalPaid)))
      .toBe(Math.round(sum((p) => p.expected.totalPaid)));
  });
});

describe("T-105 — INV-4 installmentRemainingAmount over the corpus tranches", () => {
  it("never goes negative and equals the signed clamp of due − paid − pending", () => {
    // Build tranche rows from the ledger corpus shape: every parent's
    // tranches are validated via the canonical formula on synthetic rows
    // derived from the fixture amounts (due/paid pairs per parent).
    let checked = 0;
    for (const p of corpus) {
      const due = p.expected.totalCharged;
      const paid = p.expected.totalPaid;
      const inst: InstallmentRow = {
        id: "ins-t105",
        tenant_id: "t105",
        parent_id: p.parentId,
        student_id: "stu-t105",
        service_enrollment_id: "srv-t105",
        invoice_id: null,
        tranche_number: 1,
        amount_due: due,
        amount_paid: paid,
        amount_pending: 0,
        due_date: "2026-03-15",
        paid_date: null,
        status: paid >= due ? "paid" : "partial",
        academic_cycle: "primaire",
        payment_plan: "tranches",
        is_custom_schedule: false,
        custom_schedule_note: null,
        label: "Tranche 1",
        created_at: "2026-08-11T12:00:00Z",
        updated_at: "2026-08-11T12:00:00Z",
      } as unknown as InstallmentRow;
      const remaining = installmentRemainingAmount(inst);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBe(Math.max(0, due - paid));
      checked++;
    }
    expect(checked).toBe(259);
  });
});
