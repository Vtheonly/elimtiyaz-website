/**
 * T-347 (MATIERE-500 / ADR-018) — the website port of the canonical
 * subject-configuration module. The SAME vectors as the desktop suite
 * (src/tests/domain/academics/subject-config.test.ts) and the corpus
 * subject_configuration category: the port must be equivalent to the
 * desktop engine AND to the SQL trigger of migration 0094.
 */
import { describe, it, expect } from "vitest";
import {
  resolveSubjectConfiguration,
  computeSubjectAverageFromRecipe,
  DEFAULT_GRADING_RECIPE,
  type SubjectConfigurationRow,
} from "@/lib/canonical/subject-config";
import { computeSubjectAverage } from "@/lib/canonical/model/academic";

const LEGACY = {
  id: "subj-ar",
  code: "AR",
  coefficient: 3,
  passingGrade: 10,
  isExtracurricular: false,
};

function config(
  over: Partial<SubjectConfigurationRow> = {},
): SubjectConfigurationRow {
  return {
    subjectId: "subj-ar",
    academicYearId: "ay-1",
    academicLevelId: "al-4am",
    direction: "general",
    coefficient: 4,
    subjectCode: null,
    passingGrade: 10,
    isExtracurricular: false,
    gradingRecipe: { devoir1: 1, devoir2: 1, examen: 2, cc: 0 },
    isActive: true,
    ...over,
  };
}

describe("resolveSubjectConfiguration (the ported ONE rule)", () => {
  it("the configuration row wins when the context matches", () => {
    const r = resolveSubjectConfiguration({
      subject: LEGACY,
      configurations: [config()],
      academicLevelId: "al-4am",
      academicYearId: "ay-1",
    });
    expect(r.coefficient).toBe(4);
    expect(r.source).toBe("configuration");
  });

  it("falls through to the legacy directory when no context row matches", () => {
    const r = resolveSubjectConfiguration({
      subject: LEGACY,
      configurations: [config()],
      academicLevelId: "al-1ap",
      academicYearId: "ay-1",
    });
    expect(r.coefficient).toBe(3);
    expect(r.source).toBe("legacy-subject");
  });

  it("the snapshot wins over the live configuration (non-retroactive)", () => {
    const r = resolveSubjectConfiguration({
      subject: LEGACY,
      configurations: [config({ coefficient: 4 })],
      academicLevelId: "al-4am",
      academicYearId: "ay-1",
      snapshot: {
        coefficient: 3,
        coefficientDevoir1: 1,
        coefficientDevoir2: 1,
        coefficientExamen: 2,
        coefficientCc: 0,
      },
    });
    expect(r.coefficient).toBe(3);
  });

  it("inactive rows are ignored", () => {
    const r = resolveSubjectConfiguration({
      subject: LEGACY,
      configurations: [config({ isActive: false, coefficient: 9 })],
      academicLevelId: "al-4am",
      academicYearId: "ay-1",
    });
    expect(r.coefficient).toBe(3);
  });
});

describe("computeSubjectAverageFromRecipe (the ported engine)", () => {
  it("the DEFAULT recipe is bit-identical to the historical engine", () => {
    const vectors: Array<[number, number, number]> = [
      [14, 16, 18],
      [11, 11, 11],
      [7, 7, 20],
      [12.5, 13.25, 14.125],
      [0, 20, 10],
    ];
    for (const [d1, d2, ex] of vectors) {
      expect(computeSubjectAverageFromRecipe(d1, d2, ex, null, DEFAULT_GRADING_RECIPE)).toBe(
        computeSubjectAverage(d1, d2, ex),
      );
    }
  });

  it("the migration-0094 probe values", () => {
    // C4: (15×1 + 12×2)/3 = 13 — the cc recipe.
    expect(
      computeSubjectAverageFromRecipe(null, null, 12, 15, {
        devoir1: 0,
        devoir2: 0,
        examen: 2,
        cc: 1,
      }),
    ).toBe(13);
    // C5: cc weight 0 ignored — the legacy value.
    expect(computeSubjectAverageFromRecipe(12, 14, 16, 18, DEFAULT_GRADING_RECIPE)).toBe(14.5);
    // D1: the four-component recipe (10+10+20+12)/5 = 10.4.
    expect(
      computeSubjectAverageFromRecipe(10, 10, 10, 12, {
        devoir1: 1,
        devoir2: 1,
        examen: 2,
        cc: 1,
      }),
    ).toBe(10.4);
  });

  it("a positive-weight component is required — missing → null", () => {
    expect(computeSubjectAverageFromRecipe(12, null, 16, null)).toBeNull();
    expect(
      computeSubjectAverageFromRecipe(12, 14, 16, null, {
        devoir1: 1,
        devoir2: 1,
        examen: 2,
        cc: 1,
      }),
    ).toBeNull();
  });
});
