/**
 * T-211 regression tests — the per-child ENROLLMENTS surface (owner
 * mandate, 32nd session 2026-09-07: "the children's enrollments" were
 * missing from the portal entirely).
 *
 * Pre-T-211 facts this file pins:
 *   1. The useServiceEnrollments hook (portal-queries.ts) shipped with
 *      ZERO consumers — a read hook for the canonical table that no view
 *      ever called. T-211's StudentEnrollmentsCard is its first consumer.
 *   2. The REAL per-student fee data lives in `installments` (1 276 live
 *      rows, 100% student-attributed) — the new useInstallmentsForStudent
 *      hook reads it (the financial view's parent-level hook stays
 *      untouched — different query shape, no fork).
 *   3. Installment status rendering reuses the financial view's canonical
 *      paymentStatusTone (no second status-tone implementation — the
 *      codebase's audits demand one derivation per platform).
 *   4. Amounts render through the canonical formatCurrency (UI-301: the
 *      formatters are parity-pinned and must never be forked for display).
 *   5. Transport service enrollments resolve their destination label
 *      (label_fr first) via the new useTransportDestination hook, and the
 *      TransportDestinationRow type + Database entry exist (WEAK-017: no
 *      `as unknown as` casts).
 *   6. Every new key exists in ALL THREE locales, once per locale block.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

const CARD = read("features/profile/student-enrollments-card.tsx");
const QUERIES = read("lib/hooks/portal-queries.ts");
const CHILDREN_CARD = read("features/profile/children-info-card.tsx");
const DATABASE_TS = read("lib/types/database.ts");

const T211_KEYS = [
  "enrollments.title",
  "enrollments.academicYear",
  "enrollments.services",
  "enrollments.servicesEmpty",
  "enrollments.feeSchedule",
  "enrollments.feeScheduleEmpty",
  "enrollments.destination",
  "enrollments.inactive",
  "enrollments.service.club",
  "enrollments.service.psychotherapy",
  "enrollments.service.rattrapage",
];

describe("T-211 — the enrollments card consumes canonical data sources", () => {
  it("useServiceEnrollments finally has a consumer (was: zero consumers)", () => {
    expect(CARD).toMatch(
      /import \{\s*useServiceEnrollments,\s*useInstallmentsForStudent,\s*useCurrentAcademicYear,\s*useTransportDestination,\s*\} from "@\/lib\/hooks\/portal-queries"/,
    );
  });

  it("the three new hooks live in portal-queries.ts (no parallel query module)", () => {
    for (const hook of [
      "useInstallmentsForStudent",
      "useCurrentAcademicYear",
      "useTransportDestination",
    ]) {
      expect(QUERIES).toContain(`export function ${hook}`);
    }
    // The per-student installment query filters by student_id and orders
    // by tranche_number (the canonical schedule order).
    expect(QUERIES).toMatch(/\.eq\("student_id", studentId\)[\s\S]{0,200}\.order\("tranche_number"/);
  });

  it("the card is mounted per child inside ChildrenInfoCard", () => {
    expect(CHILDREN_CARD).toContain(
      'import { StudentEnrollmentsCard } from "@/features/profile/student-enrollments-card"',
    );
    expect(CHILDREN_CARD).toMatch(/<StudentEnrollmentsCard studentId=\{kid\.id\} \/>/);
  });

  it("installment status + amounts render through the canonical helpers", () => {
    expect(CARD).toContain("paymentStatusTone(inst.status)");
    expect(CARD).toContain("formatCurrency(inst.amount_due)");
    // No local status-tone switch in the enrollments card (one derivation).
    expect(CARD).not.toMatch(/switch \(inst\.status\)/);
  });

  it("service_kind labels cover the canonical CHECK values (0007)", () => {
    for (const kind of [
      "tuition",
      "transport",
      "canteen",
      "club",
      "speech_therapy",
      "psychology",
      "psychotherapy",
      "second_apron",
      "rattrapage",
      "other",
    ]) {
      expect(CARD).toContain(`${kind}: "`);
    }
    // Transport enrollments resolve the destination label.
    expect(CARD).toContain("useTransportDestination(destinationId)");
    expect(CARD).toMatch(/label_fr \|\| .*label_ar \|\| .*code/);
  });

  it("TransportDestinationRow is typed + registered in the Database interface (WEAK-017)", () => {
    expect(DATABASE_TS).toContain("export type TransportDestinationRow = {");
    expect(DATABASE_TS).toContain(
      "transport_destinations: { Row: TransportDestinationRow;",
    );
    // No unknown-cast escape hatch in the hook.
    expect(QUERIES).not.toMatch(/as unknown as TransportDestinationRow/);
  });
});

describe("T-211 — i18n dictionary completeness (fr / ar / en)", () => {
  it("every new key exists exactly once per locale block", () => {
    const dict = read("lib/i18n/dictionary.ts");
    for (const key of T211_KEYS) {
      const occurrences = dict.split(`"${key}":`).length - 1;
      expect(occurrences, `"${key}" must exist exactly 3 times (fr/ar/en)`).toBe(3);
    }
  });
});
