/**
 * T-327/T-328/T-329/T-330 — 58th-session portal regression guards.
 *
 * Pins the four website halves of the owner mandate ("fully responsive
 * desktop-wide layout; personal per-child dossier incl. notes + history;
 * payment coverage with the EXACT desktop logic; everything consistent"):
 *
 *   1. T-327 — the app shell is a real desktop layout at lg+: flex-ROW
 *      wrapper (the rail previously STACKED ABOVE the content — the
 *      "stretched mobile" symptom), sticky full-height rail, no
 *      lg:pl-0 padding remnant.
 *   2. T-328 — the dossier dialog is i18n-complete: every user-facing
 *      string routes through the dictionary (the 58th-session audit found
 *      ~20 hardcoded French strings in the previous iteration).
 *   3. T-329 — the dossier consumes the CANONICAL academic-history table
 *      through the shared portal-queries hook (RLS parent policy 0091).
 *   4. T-330 — the payment coverage goes through the canonical
 *      payment-coverage module (payment_allocations → ledger fallback →
 *      single line) — desktop parity — and the coverage strings are
 *      dictionary keys too.
 *   5. The dictionary carries every new key exactly once per locale block.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

const SHELL = read("features/shared/app-shell.tsx");
const BOTTOM_NAV = read("features/shared/bottom-nav.tsx");
const CHILDREN_CARD = read("features/profile/children-info-card.tsx");
const FINANCIAL = read("features/financial/financial-view.tsx");
const DICT = read("lib/i18n/dictionary.ts");
const QUERIES = read("lib/hooks/portal-queries.ts");
const COVERAGE = read("lib/canonical/payment-coverage.ts");

const T327_KEYS = [
  "student.dossier.open",
  "student.dossier.overview",
  "student.dossier.enrollments",
  "student.dossier.identity",
  "student.noClass",
  "student.age",
  "student.history.previousYears",
  "student.history.firstYear",
  "finance.payment.coverage.hide",
  "finance.payment.coverageLoadError",
  "finance.payment.coverageDerivedHint",
  "finance.installment.daysLeft",
];

describe("T-327 — the shell is an intentional desktop layout at lg+", () => {
  it("the wrapper switches to flex-row at lg (the rail sits BESIDE the content)", () => {
    expect(SHELL).toContain("lg:flex-row");
    // The padding remnant from the stacked-era wrapper is gone.
    expect(SHELL).not.toContain("lg:pl-0");
  });

  it("the desktop rail is sticky + full-height (visible while content scrolls)", () => {
    expect(BOTTOM_NAV).toContain("lg:sticky");
    expect(BOTTOM_NAV).toContain("lg:h-screen");
  });
});

describe("T-328 — the dossier dialog is i18n-complete (no hardcoded French)", () => {
  it("every dossier label routes through the dictionary", () => {
    for (const banned of [
      "Dossier complet de l'élève",
      "Vue d'ensemble",
      "Historique Scolaire",
      "Inscriptions Financières",
      "Aucune classe assignée",
      "Moyenne Générale",
      "Appréciation / Bilan",
      "Années précédentes",
      "Aucune note médicale",
      "première année de l'élève",
    ]) {
      expect(CHILDREN_CARD, `hardcoded string: ${banned}`).not.toContain(banned);
    }
    for (const key of [
      "student.dossier.open",
      "student.dossier.overview",
      "student.dossier.enrollments",
      "student.dossier.identity",
      "student.noClass",
      "student.age",
      "student.history.previousYears",
      "student.history.firstYear",
      "student.notes.title",
      "student.notes.empty",
    ]) {
      expect(CHILDREN_CARD, `missing t() usage: ${key}`).toContain(`t("${key}")`);
    }
  });

  it("the dialog's tab row follows the T-202 scrollable-chip idiom below sm", () => {
    expect(CHILDREN_CARD).toContain("overflow-x-auto scrollbar-none");
    expect(CHILDREN_CARD).toMatch(/shrink-0/);
  });

  it("the coverage strings in the financial view are dictionary keys", () => {
    for (const banned of [
      "Détails de la couverture",
      "Masquer la couverture",
      "Impossible de charger les détails",
      "Montant attendu (Facturé)",
      "Trop-perçu (Crédit parent)",
      "J-{days}",
    ]) {
      expect(FINANCIAL, `hardcoded string: ${banned}`).not.toContain(banned);
    }
    for (const key of [
      "finance.payment.coverage",
      "finance.payment.coverage.hide",
      "finance.payment.coverageLoadError",
      "finance.payment.coverageDerivedHint",
      "finance.payment.expectedAmount",
      "finance.payment.excessAmount",
      "finance.installment.daysLeft",
    ]) {
      expect(FINANCIAL, `missing t() usage: ${key}`).toContain(`t("${key}"`);
    }
  });
});

describe("T-329 — the dossier reads the canonical history table", () => {
  it("the hook queries student_academic_histories (the 0029 canonical table)", () => {
    expect(QUERIES).toContain("from(\"student_academic_histories\")");
    expect(QUERIES).toMatch(/order\("academic_year", \{ ascending: false \}\)/);
  });

  it("the dossier renders decision/GPA/rank/narrative from the history rows", () => {
    expect(CHILDREN_CARD).toContain("PROMOTION_DECISION_LABELS_FR");
    expect(CHILDREN_CARD).toMatch(/h\.gpa\.toFixed\(2\)/);
    expect(CHILDREN_CARD).toMatch(/h\.rank/);
    expect(CHILDREN_CARD).toMatch(/h\.narrative/);
  });
});

describe("T-330 — payment coverage goes through the canonical module", () => {
  it("the financial view consumes paymentCoverageLines (no inline derivation)", () => {
    expect(FINANCIAL).toContain(
      'import { paymentCoverageLines } from "@/lib/canonical/payment-coverage"',
    );
    expect(FINANCIAL).toContain("paymentCoverageLines(");
    // No parallel inline derivation of allocations in the view.
    expect(FINANCIAL).not.toMatch(/allocations\.data\.map\(\(alloc\)/);
  });

  it("the module implements the desktop precedence chain (table → ledger → single)", () => {
    expect(COVERAGE).toContain("paymentCoverageLines");
    expect(COVERAGE).toContain("deriveAllocationsFromLedger");
    expect(COVERAGE).toContain("allocationRowsToLines");
    expect(COVERAGE).toMatch(/entry_type === "payment"/);
    expect(COVERAGE).toMatch(/Math\.abs\(e\.amount\)/);
  });

  it("the ledger entries flow into every payment row (the fallback input)", () => {
    expect(FINANCIAL).toContain("ledgerEntries={ledgerEntries.data ?? []}");
  });
});

describe("T-327..T-330 — dictionary completeness (fr / ar / en)", () => {
  it("every new key exists exactly once per locale block", () => {
    for (const key of T327_KEYS) {
      const occurrences = DICT.split(`"${key}":`).length - 1;
      expect(occurrences, `"${key}" must exist exactly 3 times (fr/ar/en)`).toBe(3);
    }
  });
});
