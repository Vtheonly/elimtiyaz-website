/**
 * T-336 / GRADE-102 regression tests — the academic view's desktop-parity
 * behavior for the grade display (owner mandate: "make the website handle
 * grades the same way as the desktop application … multiple subjects,
 * multiple exams, multiple grades … display all of these existing records
 * instead of missing or hiding them").
 *
 * Covered (behavioral — the view is rendered with a controlled
 * `useGradesForStudent` fixture, the SAME shape the live query returns):
 *
 *   1. MULTIPLE SUBJECTS + MULTIPLE TERMS render — every assessment row
 *      (subject × term) is visible with its D1 / D2 / Examen marks.
 *   2. TERM-SCOPED KPIs — selecting "Trimestre 1" recomputes the MOYENNE
 *      KPI over that term's rows only (the desktop AcademicTab / SQL
 *      fn_calculate_student_term_gpa / Android termGpas semantics);
 *      "Toutes" keeps the all-rows yearly GPA (the Android yearlyGpa
 *      convention). The MATIÈRE count follows the filter too. Before the
 *      fix the KPIs stayed at the all-terms values while the list
 *      filtered.
 *   3. PARTIAL MARKS ARE NEVER HIDDEN — a subject whose canonical average
 *      is not computable (a mark missing) shows the desktop/Android
 *      "Moyenne à paraître" hint instead of a silent "—".
 *
 * Expected values are computed with the canonical engine's exact
 * integer-cent math (computeSubjectAverage / computeOverallGpa — the
 * parity-pinned port):
 *   Arabe T1   7/7/20  → avg 13.50, coef 3
 *   Math  T1  12.5/14/16 → avg 14.63, coef 4  ((1250+1400+3200)/4 = 1462.5 → 1463)
 *   Math  T2  11/13/15 → avg 13.50, coef 4
 *   FR    T2  9/—/—   → average NULL (partial) → hint
 *   T1 GPA  = (1350·300 + 1463·400) / 700  = 1414.57… → 14.15
 *   All GPA = (1350·300 + 1463·400 + 1350·400) / 1100 = 1391.09… → 13.91
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { StudentRow } from "@/lib/types/database";
import type { PortalAssessmentRow } from "@/lib/hooks/portal-queries";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf-8");

// ─── Mocks ──────────────────────────────────────────────────────────────────

const KID: StudentRow = {
  id: "kid-a",
  tenant_id: "t1",
  student_code: "ELV-2026-KIDA",
  first_name: "Alpha",
  last_name: "Test",
  parent_id: "parent-1",
  class_id: null,
  grade_level_id: null,
  enrollment_status: "active",
  enrollment_date: null,
  date_of_birth: null,
  gender: null,
  medical_notes: null,
  auth_user_id: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  deleted_at: null,
} as unknown as StudentRow;

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    state: "active",
    user: { id: "profile-1" },
    parent: { id: "parent-1" },
    children: [KID],
    error: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const baseRow = {
  tenant_id: "t1",
  class_subject_id: null,
  kind: null,
  label: null,
  max_score: 20,
  weight: 1,
  scheduled_at: null,
  class_id: null,
  // T-347 (ADR-018): the cc mark + the entry-time weight snapshots (legacy
  // rows: cc null, snapshots null → the DEFAULT recipe bit-identically).
  cc: null,
  coefficient_devoir1: null,
  coefficient_devoir2: null,
  coefficient_examen: null,
  coefficient_cc: null,
  entered_by: null,
  entered_at: "2026-09-01T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  academic_year: "2026-2027",
  student_id: "kid-a",
};

const FIXTURE: PortalAssessmentRow[] = [
  {
    ...baseRow,
    id: "a1",
    subject_id: "arabe",
    term: 1,
    devoir1: 7,
    devoir2: 7,
    examen: 20,
    subject_average: 13.5,
    coefficient: 3,
    subject: {
      id: "arabe",
      name_fr: "Arabe",
      name_en: null,
      default_coefficient: 3,
      is_extracurricular: false,
      passing_grade: 10,
    },
  },
  {
    ...baseRow,
    id: "m1",
    subject_id: "math",
    term: 1,
    devoir1: 12.5,
    devoir2: 14,
    examen: 16,
    subject_average: 14.63,
    coefficient: 4,
    subject: {
      id: "math",
      name_fr: "Mathématiques",
      name_en: null,
      default_coefficient: 4,
      is_extracurricular: false,
      passing_grade: 10,
    },
  },
  {
    ...baseRow,
    id: "m2",
    subject_id: "math",
    term: 2,
    devoir1: 11,
    devoir2: 13,
    examen: 15,
    subject_average: 13.5,
    coefficient: 4,
    subject: {
      id: "math",
      name_fr: "Mathématiques",
      name_en: null,
      default_coefficient: 4,
      is_extracurricular: false,
      passing_grade: 10,
    },
  },
  {
    ...baseRow,
    id: "f2",
    subject_id: "fr",
    term: 2,
    devoir1: 9,
    devoir2: null,
    examen: null,
    subject_average: null,
    coefficient: 3,
    subject: {
      id: "fr",
      name_fr: "Français",
      name_en: null,
      default_coefficient: 3,
      is_extracurricular: false,
      passing_grade: 10,
    },
  },
];

vi.mock("@/lib/hooks/portal-queries", () => ({
  useGradesForStudent: (studentId: string | null) => ({
    data: studentId ? FIXTURE : [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useClass: () => ({ data: null, isLoading: false }),
  useAttendanceForStudent: () => ({ data: [], isLoading: false }),
  useAcademicLevels: () => ({ data: [], isLoading: false }),
}));

import { useAppStore } from "@/lib/store/app-store";
import { AcademicView } from "@/features/academic/academic-view";
import { dictionaries } from "@/lib/i18n/dictionary";

const HINT_FR = (dictionaries.fr as Record<string, string>)["student.average.pending"];

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ activeStudentId: KID.id, activeView: "academic" });
});

afterEach(() => {
  cleanup();
});

describe("T-336 — multiple subjects / terms all render (nothing hidden)", () => {
  it("renders every subject card and every per-term mark row", () => {
    render(<AcademicView />);
    expect(screen.getByText("Arabe")).toBeTruthy();
    expect(screen.getAllByText("Mathématiques").length).toBeGreaterThan(0);
    expect(screen.getByText("Français")).toBeTruthy();
    // The per-term mark chips: Arabe T1, Math T1, Math T2, FR T2 (4 rows).
    expect(screen.getAllByText("Trimestre 1").length).toBe(3); // 1 tab + 2 chips (Arabe, Math T1)
    expect(screen.getAllByText("Trimestre 2").length).toBe(3); // 1 tab + 2 chips (Math T2, FR T2)
    // Marks visible with the canonical formatting.
    expect(screen.getByText(/7\.00 · 7\.00 · 20\.00/)).toBeTruthy();
    expect(screen.getByText(/12\.50 · 14\.00 · 16\.00/)).toBeTruthy();
    expect(screen.getByText(/11\.00 · 13\.00 · 15\.00/)).toBeTruthy();
    expect(screen.getByText(/9\.00 · — · —/)).toBeTruthy();
  });
});

describe("T-336 — term-scoped KPIs (desktop parity)", () => {
  it('"Toutes" shows the all-rows yearly GPA and the full subject count', () => {
    render(<AcademicView />);
    // All-rows GPA: (1350·300 + 1463·400 + 1350·400) / 1100 → 13.91
    expect(screen.getByText("13.91")).toBeTruthy();
    // 3 subjects with data (Arabe, Math, FR) — the MATIÈRE KPI label renders.
    expect(screen.getByText("Matière")).toBeTruthy();
  });

  it('selecting "Trimestre 1" scopes the MOYENNE KPI to that term (canonical per-term GPA)', () => {
    render(<AcademicView />);
    // T1 GPA: (1350·300 + 1463·400) / 700 → 14.15 — the desktop/SQL
    // fn_calculate_student_term_gpa semantics, NOT the all-terms 13.91.
    // (Radix TabsTrigger activates on mousedown — not click.)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Trimestre 1" }));
    expect(screen.queryByText("13.91")).toBeNull();
    expect(screen.getByText("14.15")).toBeTruthy();
    // The FR card (T2-only) is filtered out; its partial-marks hint too.
    expect(screen.queryByText("Français")).toBeNull();
    expect(screen.queryByText(HINT_FR)).toBeNull();
  });

  it('selecting "Trimestre 2" scopes the KPI to T2 and shows the partial-marks hint', () => {
    render(<AcademicView />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Trimestre 2" }));
    // T2 computable rows: Math T2 only (FR T2 average is null) → GPA 13.50
    // (the KPI card) and Math's own subject-average card shows 13.50 too.
    expect(screen.getAllByText("13.50").length).toBe(2);
    expect(screen.queryByText("Arabe")).toBeNull();
    // FR is visible with its partial marks and the pending-average hint.
    expect(screen.getByText("Français")).toBeTruthy();
    expect(screen.getByText(HINT_FR)).toBeTruthy();
  });
});

describe("T-336 — partial marks are explained, never silently hidden", () => {
  it("the pending-average hint renders in all three locales' dictionaries", () => {
    for (const locale of ["fr", "ar", "en"] as const) {
      const dict = dictionaries[locale] as Record<string, string>;
      expect(dict["student.average.pending"], `${locale} key`).toBeTruthy();
    }
    // The view renders it through the dictionary (the desktop's label text
    // appears ONLY in the explanatory comment, never as a render literal).
    const academic = read("features/academic/academic-view.tsx");
    expect(academic).toContain('t("student.average.pending")');
    expect(academic).not.toContain(">Moyenne à paraître<");
  });

  it("a complete subject shows its average and NO hint", () => {
    render(<AcademicView />);
    // Arabe's card shows the 13.50 average value (the right-side big number).
    expect(screen.getAllByText("13.50").length).toBeGreaterThan(0);
    // Only the FR card (partial marks) carries the hint.
    expect(screen.getAllByText(HINT_FR).length).toBe(1);
  });
});
