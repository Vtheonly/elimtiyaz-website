/**
 * T-210 regression tests — the portal's children identity + enrollment
 * detail card (owner mandate, 32nd session 2026-09-07: "not enough detailed
 * information about the parents' children").
 *
 * Before T-210 children appeared ONLY as name + student_code (dashboard
 * child card / student switcher). The canonical `students` row's identity
 * fields (date of birth, gender, grade level, class, enrollment date,
 * enrollment status — fetched by the AuthProvider's `students.*` select)
 * were never rendered anywhere in the portal.
 *
 * These source-scan tests pin:
 *   1. The children card renders the full students-row detail set.
 *   2. It reuses the EXISTING portal query hooks (useAcademicLevels /
 *      useClass from portal-queries.ts — no parallel implementation).
 *   3. The age helper computes whole years from a YYYY-MM-DD date.
 *   4. Gender + enrollment-status label maps cover the canonical CHECK
 *      constraint values (0005_crm.sql).
 *   5. The card is mounted in the Profile view (parents can actually reach
 *      it — the "unused component" failure mode of the shipped-but-dead
 *      useServiceEnrollments hook).
 *   6. Every new key exists in ALL THREE locales, once per locale block.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

const CHILDREN_CARD = read("features/profile/children-info-card.tsx");
const PROFILE_VIEW = read("features/profile/profile-view.tsx");

const T210_KEYS = [
  "children.title",
  "children.identityNote",
  "student.dateOfBirth",
  "student.gender",
  "student.gender.male",
  "student.gender.female",
  "student.gender.other",
  "student.enrollmentDate",
  "student.yearsOld",
  "student.status.inquiry",
  "student.status.quoted",
  "student.status.enrolled",
  "student.status.active",
  "student.status.withdrawn",
  "student.status.graduated",
];

describe("T-210 — children identity + enrollment detail card", () => {
  it("renders the full canonical students-row detail set", () => {
    for (const field of [
      "student_code",
      "date_of_birth",
      "gender",
      "grade_level_id",
      "class_id",
      "enrollment_date",
      "enrollment_status",
    ]) {
      expect(CHILDREN_CARD, `children card must render students.${field}`).toContain(field);
    }
  });

  it("reuses the existing portal query hooks (no parallel implementation)", () => {
    expect(CHILDREN_CARD).toMatch(
      /import \{\s*useAcademicLevels,\s*useClass,\s*\} from "@\/lib\/hooks\/portal-queries"/,
    );
    expect(CHILDREN_CARD).toContain("useAuth()");
  });

  it("is mounted in the Profile view (not a dead component)", () => {
    expect(PROFILE_VIEW).toContain(
      'import { ChildrenInfoCard } from "@/features/profile/children-info-card"',
    );
    expect(PROFILE_VIEW).toMatch(/<ChildrenInfoCard \/>/);
  });

  it("computeAge derives whole years from a YYYY-MM-DD date", async () => {
    const { computeAge } = await import("@/features/profile/children-info-card");
    const now = new Date();
    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    // A birthday exactly 10 years ago today → 10.
    expect(computeAge(toIso(new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())))).toBe(10);
    // Age of someone born today is 0.
    expect(computeAge(toIso(now))).toBe(0);
    // Born 10 years ago minus 5 days → the 10th birthday is in 5 days → 9.
    // (Date normalizes day overflow across month/year boundaries.)
    expect(
      computeAge(toIso(new Date(now.getFullYear() - 10, now.getMonth(), now.getDate() + 5))),
    ).toBe(9);
  });

  it("gender + enrollment status maps cover the canonical CHECK values", () => {
    for (const g of ["male", "female", "other"]) {
      expect(CHILDREN_CARD).toContain(`${g}: "student.gender.`);
    }
    for (const s of [
      "inquiry",
      "quoted",
      "enrolled",
      "active",
      "withdrawn",
      "graduated",
    ]) {
      expect(CHILDREN_CARD).toContain(`${s}: "student.status.`);
    }
  });

  it("every T-210 key exists in all three locale blocks, once per locale", () => {
    const dict = read("lib/i18n/dictionary.ts");
    for (const key of T210_KEYS) {
      const occurrences = dict.split(`"${key}":`).length - 1;
      expect(occurrences, `"${key}" must exist exactly 3 times (fr/ar/en)`).toBe(3);
    }
  });
});
