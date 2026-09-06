/**
 * Shared child-summary label helpers (T-213).
 *
 * One derivation per platform for the child's "level · class" summary —
 * consumed by BOTH the profile's ChildIdentityCard (T-210) and the
 * dashboard's child cards (T-213). Before this module each surface would
 * have derived its own join of academic_levels (year_label · grade_code)
 * and classes (name/code · room) — exactly the duplicate-implementation
 * shape the audits forbid (DUP-001…005, UI-304's lesson: same data, two
 * renderings).
 */

import type { AcademicLevelRow, ClassRow, StudentRow } from "@/lib/types/database";

/** "1ère Année Primaire · 1ap" (either part alone when the other is null). */
export function childLevelLabel(
  levels: AcademicLevelRow[] | null | undefined,
  gradeLevelId: string | null | undefined,
): string | null {
  const level = levels?.find((l) => l.id === gradeLevelId) ?? null;
  if (!level) return null;
  return [level.year_label, level.grade_code].filter(Boolean).join(" · ") || null;
}

/** "1ère Année Moyenne · A" (code fallback when name is null; room appended). */
export function childClassLabel(klass: ClassRow | null | undefined): string | null {
  if (!klass) return null;
  return [klass.name ?? klass.code, klass.room].filter(Boolean).join(" · ") || null;
}

/** "Niveau · Classe" combined line, omitting missing halves. */
export function childLevelClassLine(
  levels: AcademicLevelRow[] | null | undefined,
  klass: ClassRow | null | undefined,
  kid: Pick<StudentRow, "grade_level_id">,
): string | null {
  const parts = [
    childLevelLabel(levels, kid.grade_level_id),
    childClassLabel(klass),
  ].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" · ") : null;
}
