/**
 * CANONICAL ENGINE PORT (website) — verbatim port of the desktop canonical
 * subject-configuration module (T-347 / MATIERE-500 / ADR-018).
 * Source: elimtiyaz-desktop/src/domain/calc/academics/subject-config.ts
 * Source sha256 (first 12): d902b8f0938c
 * Equivalence: pinned by src/lib/canonical/subject-config.test.ts (the same
 * vectors as the desktop suite + the corpus subject_configuration category).
 *
 * When refreshing this file, port the functions verbatim from the desktop
 * source and keep the exported surface identical (the website is a read-only
 * portal — ADR-002).
 */

// ─── Types (mirrored from the desktop domain model) ─────────────────────────

/** The component-weight recipe of a subject's term average (ADR-018). */
export interface GradingRecipe {
  readonly devoir1: number;
  readonly devoir2: number;
  readonly examen: number;
  /** Contrôle continu (المراقبة المستمرة) weight — 0 = excluded. */
  readonly cc: number;
}

/** The DEFAULT recipe — bit-identical to (D1 + D2 + 2×Ex) / 4. */
export const DEFAULT_GRADING_RECIPE: GradingRecipe = {
  devoir1: 1,
  devoir2: 1,
  examen: 2,
  cc: 0,
};

/** The legacy subject-directory layer the resolver falls back to. */
export interface LegacySubjectLayer {
  readonly id?: string;
  readonly code?: string;
  readonly coefficient?: number;
  readonly passingGrade?: number;
  readonly isExtracurricular?: boolean;
}

/** A context-specific subject configuration row (migration 0094). */
export interface SubjectConfigurationRow {
  readonly subjectId: string;
  readonly academicYearId: string;
  readonly academicLevelId: string;
  readonly direction?: string;
  readonly coefficient: number;
  readonly subjectCode?: string | null;
  readonly passingGrade?: number;
  readonly isExtracurricular?: boolean;
  readonly gradingRecipe?: GradingRecipe;
  readonly isActive?: boolean;
}

/** What the resolver hands back — everything a surface needs, one source. */
export interface ResolvedSubjectContext {
  readonly coefficient: number;
  readonly subjectCode: string;
  readonly passingGrade: number;
  readonly isExtracurricular: boolean;
  readonly gradingRecipe: GradingRecipe;
  readonly source: "configuration" | "legacy-subject" | "default";
}

export interface ResolveSubjectContextInput {
  readonly subject: LegacySubjectLayer | undefined;
  readonly configurations: readonly SubjectConfigurationRow[];
  readonly academicLevelId?: string | null;
  readonly academicYearId?: string | null;
  readonly direction?: string;
  readonly snapshot?: {
    readonly coefficient?: number | null;
    readonly coefficientDevoir1?: number | null;
    readonly coefficientDevoir2?: number | null;
    readonly coefficientExamen?: number | null;
    readonly coefficientCc?: number | null;
  } | null;
}

function normalizeRecipe(raw: unknown): GradingRecipe {
  if (raw == null || typeof raw !== "object") return DEFAULT_GRADING_RECIPE;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  return {
    devoir1: num(r.devoir1, DEFAULT_GRADING_RECIPE.devoir1),
    devoir2: num(r.devoir2, DEFAULT_GRADING_RECIPE.devoir2),
    examen: num(r.examen, DEFAULT_GRADING_RECIPE.examen),
    cc: num(r.cc, DEFAULT_GRADING_RECIPE.cc),
  };
}

/**
 * THE canonical subject-configuration resolver (ADR-018 §5) — ONE rule:
 * assessment snapshot → context configuration row (exact direction, then
 * 'general') → legacy subject columns → hard default.
 */
export function resolveSubjectConfiguration(
  input: ResolveSubjectContextInput,
): ResolvedSubjectContext {
  const direction = input.direction ?? "general";
  const { subject, configurations } = input;

  const matches = configurations.filter(
    (c) =>
      c.subjectId === subject?.id &&
      c.academicLevelId === input.academicLevelId &&
      c.academicYearId === input.academicYearId &&
      (c.isActive ?? true),
  );
  const config =
    matches.find((c) => c.direction === direction) ??
    matches.find((c) => c.direction === "general");

  const legacy: ResolvedSubjectContext = {
    coefficient: subject?.coefficient ?? 1,
    subjectCode: subject?.code ?? "",
    passingGrade: subject?.passingGrade ?? 10,
    isExtracurricular: subject?.isExtracurricular ?? false,
    gradingRecipe: DEFAULT_GRADING_RECIPE,
    source: "default",
  };

  const resolved: ResolvedSubjectContext = config
    ? {
        coefficient: config.coefficient,
        subjectCode: config.subjectCode ?? subject?.code ?? "",
        passingGrade: config.passingGrade ?? 10,
        isExtracurricular: config.isExtracurricular ?? false,
        gradingRecipe: normalizeRecipe(config.gradingRecipe),
        source: "configuration",
      }
    : subject
      ? { ...legacy, source: "legacy-subject" }
      : legacy;

  const s = input.snapshot;
  if (s == null) return resolved;
  const snapC = typeof s.coefficient === "number" && s.coefficient > 0 ? s.coefficient : null;
  const snapRecipe: GradingRecipe =
    s.coefficientDevoir1 == null &&
    s.coefficientDevoir2 == null &&
    s.coefficientExamen == null &&
    s.coefficientCc == null
      ? resolved.gradingRecipe
      : {
          devoir1: s.coefficientDevoir1 ?? DEFAULT_GRADING_RECIPE.devoir1,
          devoir2: s.coefficientDevoir2 ?? DEFAULT_GRADING_RECIPE.devoir2,
          examen: s.coefficientExamen ?? DEFAULT_GRADING_RECIPE.examen,
          cc: s.coefficientCc ?? DEFAULT_GRADING_RECIPE.cc,
        };
  return {
    ...resolved,
    coefficient: snapC ?? resolved.coefficient,
    gradingRecipe: snapRecipe,
  };
}

/**
 * The recipe-aware canonical subject average — the TS mirror of the SQL
 * trigger `compute_assessments_subject_average` (migration 0094):
 * Σ(mark × weight) / Σ(weight) over the positive-weight components; every
 * one of them must be present, else null (the T-336 honesty rule).
 * Bit-parity: centi-scaled integer math (half-up) — identical to PostgreSQL
 * ROUND(numeric, 2) at .xx5 boundaries.
 */
export function computeSubjectAverageFromRecipe(
  devoir1: number | null,
  devoir2: number | null,
  examen: number | null,
  cc: number | null,
  recipe: GradingRecipe = DEFAULT_GRADING_RECIPE,
): number | null {
  if (devoir1 == null && devoir2 == null && examen == null && cc == null) {
    return null;
  }
  const w1 = Math.round(recipe.devoir1 * 100);
  const w2 = Math.round(recipe.devoir2 * 100);
  const w3 = Math.round(recipe.examen * 100);
  const wcc = Math.round(recipe.cc * 100);

  if (w1 > 0 && devoir1 == null) return null;
  if (w2 > 0 && devoir2 == null) return null;
  if (w3 > 0 && examen == null) return null;
  if (wcc > 0 && cc == null) return null;

  let weightedSumCents = 0;
  let totalWeightCents = 0;
  if (w1 > 0) {
    weightedSumCents += Math.round(devoir1! * 100) * w1;
    totalWeightCents += w1;
  }
  if (w2 > 0) {
    weightedSumCents += Math.round(devoir2! * 100) * w2;
    totalWeightCents += w2;
  }
  if (w3 > 0) {
    weightedSumCents += Math.round(examen! * 100) * w3;
    totalWeightCents += w3;
  }
  if (wcc > 0) {
    weightedSumCents += Math.round(cc! * 100) * wcc;
    totalWeightCents += wcc;
  }
  if (totalWeightCents === 0) return null;
  return Math.round(weightedSumCents / totalWeightCents) / 100;
}
