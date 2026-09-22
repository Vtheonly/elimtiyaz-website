/**
 * T-407 / SCHED-106 tests — the portal's published-timetable view.
 *
 * Problem: the website consumed NOTHING of the canonical timetable. The
 * backend had been ready since 0109/0110 (published-version RLS for every
 * tenant-authenticated account) but the portal had no view, no hook and no
 * i18n — "the web version has no timetable" (owner report).
 *
 * Fix: v_timetable_published (migration 0113 §4 — denormalized names so
 * parents, who cannot SELECT personnel/rooms under RLS, still see the
 * schedule) + usePublishedTimetable + TimetableView (the Algerian week,
 * Sunday → Thursday, SCHED-102) + the desktop-rail entry + the Academic
 * header entry for mobile.
 *
 * These tests pin:
 *  1. BEHAVIORAL — published entries render grouped by school day in the
 *     Algerian week order (Sunday → Thursday), with subject, teacher,
 *     room and the S{index} period chip.
 *  2. BEHAVIORAL — the empty state when nothing is published; the
 *     no-class state when the child has no class_id.
 *  3. SOURCE — the view reads ONLY the published projection
 *     (v_timetable_published), never the canonical tables directly
 *     (drafts/trials must never reach a parent).
 *  4. SOURCE — the desktop rail + the Academic header carry the entry.
 *  5. I18N — every timetable key exists in fr + ar + en (parity).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { useAppStore } from "@/lib/store/app-store";
import { TimetableView } from "@/features/timetable/timetable-view";
import { dictionaries } from "@/lib/i18n/dictionary";
import type { StudentRow, TimetablePublishedRow } from "@/lib/types/database";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf-8");

// ─── Mocks ──────────────────────────────────────────────────────────────────
const kid: StudentRow = {
  id: "st-1",
  tenant_id: "t-1",
  parent_id: "p-1",
  student_code: "ELV-001",
  first_name: "Amine",
  last_name: "Benali",
  gender: "male",
  birth_date: "2014-05-01",
  grade_level_code: "1am",
  grade_level_id: "gl-1",
  class_id: "cls-1",
  academic_year: "2026-2027",
  is_active: true,
  created_at: "2026-09-01",
  updated_at: "2026-09-01",
} as unknown as StudentRow;

let mockEntries: TimetablePublishedRow[] = [];
let mockClass: { name: string; code: string } | null = null;

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({ children: [kid], user: { id: "u-1" } }),
}));

vi.mock("@/lib/hooks/portal-queries", () => ({
  usePublishedTimetable: (classId: string | null) => ({
    data: classId ? mockEntries : [],
    isLoading: false,
    isError: false,
    refetch: () => Promise.resolve({} as never),
  }),
  useClass: (classId: string | null) => ({
    data: classId ? mockClass : null,
    isLoading: false,
    isError: false,
    refetch: () => Promise.resolve({} as never),
  }),
}));

function entry(
  day: TimetablePublishedRow["day"],
  periodIndex: number,
  subject: string,
  overrides: Partial<TimetablePublishedRow> = {},
): TimetablePublishedRow {
  return {
    id: `${day}-${periodIndex}-${subject}`,
    tenant_id: "t-1",
    academic_year_id: "ay-1",
    version_id: "v-1",
    class_id: "cls-1",
    class_code: "CLS-1AM-A",
    class_name: "1ère Année Moyenne A",
    subject_id: `s-${subject}`,
    subject_name_fr: subject,
    subject_name_ar: null,
    teacher_id: "per-1",
    teacher_name: "Karim Haddad",
    room_id: "r-1",
    room_label: "Salle 12",
    day,
    period_index: periodIndex,
    start_minutes: 8 * 60,
    end_minutes: 9 * 60,
    lesson_group: 1,
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  useAppStore.setState({ activeStudentId: "st-1", activeView: "timetable" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockEntries = [];
  mockClass = null;
});

// ─── 1. Behavioral: rendering ───────────────────────────────────────────────

describe("T-407 TimetableView — published entries", () => {
  it("renders the Algerian week (Sunday → Thursday) in order with subject/teacher/room", () => {
    mockClass = { name: "1ère Année Moyenne A", code: "CLS-1AM-A" };
    // Deliberately unsorted input — the view groups by day and orders the week.
    mockEntries = [
      entry("thursday", 2, "Mathématiques"),
      entry("sunday", 1, "Langue arabe"),
      entry("wednesday", 3, "Sciences physiques"),
      entry("sunday", 2, "Mathématiques"),
    ];

    const { container } = render(<TimetableView />);

    const text = container.textContent ?? "";
    expect(text).toContain("Dimanche");
    expect(text).toContain("Mercredi");
    expect(text).toContain("Jeudi");
    expect(text).toContain("Langue arabe");
    expect(text).toContain("Mathématiques");
    expect(text).toContain("Sciences physiques");
    expect(text).toContain("Karim Haddad");
    expect(text).toContain("Salle 12");
    // The S{index} period chip + the HH:MM–HH:MM range.
    expect(text).toContain("S1");
    expect(text).toContain("S2");
    expect(text).toContain("08:00");
    expect(text).toContain("09:00");
    // Friday/Saturday cards never render (the Algerian weekend).
    expect(text).not.toContain("Vendredi");
    expect(text).not.toContain("Samedi");

    // Week ordering: Sunday's card comes before Wednesday's before Thursday's.
    const dayOrder =
      text.indexOf("Dimanche") < text.indexOf("Mercredi") &&
      text.indexOf("Mercredi") < text.indexOf("Jeudi");
    expect(dayOrder).toBe(true);
  });

  it("marks consecutive double-period lessons", () => {
    mockClass = { name: "C", code: "C" };
    mockEntries = [
      entry("monday", 5, "Sciences physiques", { lesson_group: 2 }),
    ];
    const { container } = render(<TimetableView />);
    expect(container.textContent).toContain("Séance double");
  });

  it("renders the empty state when nothing is published", () => {
    mockClass = { name: "1AM A", code: "CLS-1AM-A" };
    const { container } = render(<TimetableView />);
    expect(container.textContent).toContain(
      "Aucun emploi du temps publié",
    );
  });

  it("renders the no-class state when the child has no class", () => {
    // The useAuth mock returns the shared kid object; swap its class for
    // this case and restore it afterwards.
    (kid as { class_id: string | null }).class_id = null;
    try {
      const { container } = render(<TimetableView />);
      expect(container.textContent).toContain("Aucune classe");
    } finally {
      (kid as { class_id: string | null }).class_id = "cls-1";
    }
  });
});

// ─── 3-4. Source guards ─────────────────────────────────────────────────────

describe("T-407 source guards", () => {
  it("the view reads ONLY the published projection (never the canonical tables)", () => {
    const view = read("features/timetable/timetable-view.tsx");
    expect(view).toContain("usePublishedTimetable");
    expect(view).not.toMatch(/from\(["']timetable_entries["']\)/);
    expect(view).not.toMatch(/from\(["']timetable_versions["']\)/);
  });

  it("the hook queries v_timetable_published scoped to the class", () => {
    const hooks = read("lib/hooks/portal-queries.ts");
    expect(hooks).toContain('from("v_timetable_published")');
    expect(hooks).toContain('.eq("class_id", classId)');
  });

  it("the desktop rail + the academic header carry the timetable entry", () => {
    const rail = read("features/shared/bottom-nav.tsx");
    expect(rail).toContain('view: "timetable"');
    expect(rail).toContain('labelKey: "nav.timetable"');
    const academic = read("features/academic/academic-view.tsx");
    expect(academic).toContain('setActiveView("timetable")');
  });

  it("the app-shell renders the timetable view for the activeView", () => {
    const shell = read("features/shared/app-shell.tsx");
    expect(shell).toMatch(/activeView === "timetable" && <TimetableView \/>/);
  });

  it("the view is registered in the typed database schema", () => {
    const db = read("lib/types/database.ts");
    expect(db).toContain("v_timetable_published");
    expect(db).toContain("TimetablePublishedRow");
  });
});

// ─── 5. i18n parity ─────────────────────────────────────────────────────────

describe("T-407 i18n parity (fr + ar + en)", () => {
  const TIMETABLE_KEYS = [
    "nav.timetable",
    "timetable.empty",
    "timetable.period",
    "timetable.double",
    "timetable.publishedHint",
    "timetable.day.sunday",
    "timetable.day.monday",
    "timetable.day.tuesday",
    "timetable.day.wednesday",
    "timetable.day.thursday",
    "timetable.day.friday",
    "timetable.day.saturday",
  ];

  it("every timetable key exists in every locale", () => {
    const locales = ["fr", "ar", "en"] as const;
    for (const key of TIMETABLE_KEYS) {
      for (const locale of locales) {
        expect(
          dictionaries[locale][key],
          `${key} missing in ${locale}`,
        ).toBeTruthy();
      }
    }
  });

  it("the period label interpolates {index}", () => {
    expect(dictionaries.fr["timetable.period"]).toBe("S{index}");
    expect(dictionaries.ar["timetable.period"]).toBe("ح{index}");
    expect(dictionaries.en["timetable.period"]).toBe("P{index}");
  });
});
