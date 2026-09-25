/**
 * T-413: the canonical grade-level options for the portal's student
 * application form — the SAME 13-code set as the desktop's
 * GRADE_LEVELS/GRADE_LEVEL_LABELS_FR (domain/model/student.ts) and the
 * database's students.grade_level_code CHECK family. One list, three
 * locales (the dictionary owns the translations; this module owns only
 * the CODES — the canonical identity that approve_student_application
 * validates against).
 */

export interface GradeLevelOption {
  readonly value: string;
  /** The FRENCH label — the school's operating locale; the dictionary
   * carries the per-locale display names where needed. */
  readonly label: string;
}

export const GRADE_LEVEL_OPTIONS: readonly GradeLevelOption[] = [
  { value: "prescolaire_1", label: "Préscolaire 01" },
  { value: "prescolaire_2", label: "Préscolaire 02" },
  { value: "1ap", label: "1AP" },
  { value: "2ap", label: "2AP" },
  { value: "3ap", label: "3AP" },
  { value: "4ap", label: "4AP" },
  { value: "5ap", label: "5AP" },
  { value: "1am", label: "1AM" },
  { value: "2am", label: "2AM" },
  { value: "3am", label: "3AM" },
  { value: "4am", label: "4AM" },
  { value: "1ere_annee", label: "1ère Année" },
  { value: "2eme_annee", label: "2ème Année" },
  { value: "3eme_annee", label: "3ème Année" },
];
