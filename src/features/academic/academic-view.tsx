"use client";

/**
 * AcademicView — grades + GPA view for the active student.
 *
 * Per platform matrix: portal = "View Grades" (read-only).
 * Teachers input marks from Desktop/Mobile; parents just see results.
 *
 * Layout (mobile-first):
 *   1. Student switcher (if multiple kids)
 *   2. GPA card (overall average, computed from subject_average)
 *   3. Tabs: by term (Trimestre 1 / 2 / 3)
 *   4. Per-subject grade list (coefficient, score, subject average)
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import { useGradesForStudent, useClass, useAttendanceForStudent, useAcademicLevels, type PortalAssessmentRow } from "@/lib/hooks/portal-queries";
import {
  subjectAverageFor,
  overallGpaFor,
  isPassing,
} from "@/lib/canonical/portal-derive";
import { KpiCard } from "@/features/shared/kpi-card";
import {
  SectionHeader,
  EmptyState,
  ListSkeleton,
  ErrorState,
} from "@/features/shared/state-views";
import { StudentSwitcherDropdown } from "@/features/students/student-switcher";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Award, TrendingUp, Download } from "lucide-react";
import { formatFullName } from "@/lib/format";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { printBulletin } from "@/lib/bulletin";
import { toast } from "sonner";
import type { GradeRow } from "@/lib/types/database";

// T-049: Radix Tabs is string-keyed — onValueChange always delivers
// strings ("1" | "2" | "3"), so the filter state is a string union. The
// old numeric `Term = 1 | 2 | 3` described a state that never existed.
type TermFilter = "all" | "1" | "2" | "3";

export function AcademicView() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);

  const grades = useGradesForStudent(activeKid?.id ?? null);
  const klass = useClass(activeKid?.class_id ?? null);
  const attendance = useAttendanceForStudent(activeKid?.id ?? null, { limit: 500 });
  const levels = useAcademicLevels();

  const [activeTerm, setActiveTerm] = useState<TermFilter>("all");

  const handleDownloadBulletin = () => {
    if (!activeKid) {
      toast.error("Aucun élève sélectionné");
      return;
    }
    const level = levels.data?.find((l) => l.id === activeKid.grade_level_id) ?? null;
    printBulletin({
      student: activeKid,
      klass: klass.data ?? null,
      level,
      grades: (grades.data ?? []) as never,
      attendance: attendance.data ?? [],
    });
    toast.success("Bulletin ouvert — utilisez le dialogue d'impression pour enregistrer en PDF");
  };

  // Group assessments by subject (canonical 0029 shape: one row per
  // student × subject × term × year, joined with its subject).
  const bySubject = useMemo(() => {
    if (!grades.data) return new Map<string, { subjectName: string; coefficient: number; isExtracurricular: boolean; rows: PortalAssessmentRow[] }>();
    const map = new Map<string, { subjectName: string; coefficient: number; isExtracurricular: boolean; rows: PortalAssessmentRow[] }>();
    for (const a of grades.data) {
      const key = a.subject_id ?? a.subject?.id ?? "unknown";
      const coefficient = Number(a.coefficient ?? a.subject?.default_coefficient ?? 1);
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(a);
      } else {
        map.set(key, {
          subjectName: a.subject?.name_fr ?? a.subject?.name_en ?? "—",
          coefficient,
          isExtracurricular: Boolean(a.subject?.is_extracurricular),
          rows: [a],
        });
      }
    }
    return map;
  }, [grades.data]);

  // Overall GPA — CANONICAL: coefficient-weighted over per-row canonical
  // subject averages ((D1 + D2 + 2×Ex)/4, all marks required), extracurricular
  // excluded — identical to desktop/Android engines and the SQL
  // fn_calculate_student_term_gpa function.
  const overall = useMemo(() => {
    if (bySubject.size === 0) return null;
    const inputs: Array<{ devoir1: number | null; devoir2: number | null; examen: number | null; coefficient: number; isExtracurricular: boolean }> = [];
    const stored: Array<number | null> = [];
    bySubject.forEach((s) => {
      for (const row of s.rows) {
        inputs.push({
          devoir1: row.devoir1 ?? null,
          devoir2: row.devoir2 ?? null,
          examen: row.examen ?? null,
          coefficient: s.coefficient,
          isExtracurricular: s.isExtracurricular,
        });
        stored.push(row.subject_average != null ? Number(row.subject_average) : null);
      }
    });
    return overallGpaFor(inputs, stored);
  }, [bySubject]);

  const filteredSubjects = useMemo(() => {
    if (activeTerm === "all") return bySubject;
    const m = new Map<string, { subjectName: string; coefficient: number; isExtracurricular: boolean; rows: PortalAssessmentRow[] }>();
    bySubject.forEach((s, key) => {
      const filtered = s.rows.filter((a) => String(a.term) === String(activeTerm));
      if (filtered.length > 0) m.set(key, { ...s, rows: filtered });
    });
    return m;
  }, [bySubject, activeTerm]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("nav.academic")}</h1>
        <div className="flex items-center gap-2">
          {activeKid && (
            <Button variant="outline" size="sm" onClick={handleDownloadBulletin} disabled={grades.isLoading}>
              <Download className="mr-1 h-3.5 w-3.5" />
              {t("student.bulletin")}
            </Button>
          )}
          {kids.length > 1 && <StudentSwitcherDropdown />}
        </div>
      </div>

      {/* Active student banner */}
      {activeKid && (
        <Card className="border-border/60 bg-card/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{formatFullName(activeKid)}</p>
              <p className="text-xs text-muted-foreground">
                {klass.data?.name ?? klass.data?.code ?? activeKid.student_code}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPA */}
      {grades.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4">
                <ListSkeleton count={1} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard
            label={t("student.gpa")}
            value={overall !== null ? overall.toFixed(2) : "—"}
            tone={overall !== null && isPassing(overall) ? "success" : "warning"}
            icon={<Award className="h-5 w-5" />}
            hint={`/ 20`}
          />
          <KpiCard
            label={t("student.subject")}
            value={bySubject.size}
            icon={<GraduationCap className="h-5 w-5" />}
          />
          <KpiCard
            label={t("student.term")}
            value={activeTerm === "all" ? "Toutes" : `T${activeTerm}`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Term filter */}
      <Tabs value={activeTerm} onValueChange={(v) => setActiveTerm(v as TermFilter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="1">T1</TabsTrigger>
          <TabsTrigger value="2">T2</TabsTrigger>
          <TabsTrigger value="3">T3</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTerm} className="mt-4">
          {grades.isLoading ? (
            <ListSkeleton count={4} />
          ) : grades.isError ? (
            <ErrorState title={t("common.error.title")} onRetry={() => grades.refetch()} />
          ) : filteredSubjects.size === 0 ? (
            <EmptyState title="Aucune note pour cette période" icon={<GraduationCap className="h-6 w-6" />} />
          ) : (
            <div className="space-y-2">
              {Array.from(filteredSubjects.entries()).map(([subjectId, s]) => {
                // Canonical per-row subject average: (D1 + D2 + 2×Ex)/4, all
                // three marks required — recomputed from the component marks,
                // falling back to the stored subject_average for legacy rows.
                const rowAverages = s.rows.map((a) =>
                  subjectAverageFor({
                    devoir1: a.devoir1 ?? null,
                    devoir2: a.devoir2 ?? null,
                    examen: a.examen ?? null,
                    coefficient: s.coefficient,
                    isExtracurricular: s.isExtracurricular,
                  }) ?? (a.subject_average != null ? Number(a.subject_average) : null),
                );
                const valid = rowAverages.filter((v): v is number => v != null);
                const subjectAvg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
                return (
                  <Card key={subjectId} className="border-border/50 bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{s.subjectName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("student.coefficient")}: {s.coefficient}
                            {s.isExtracurricular ? " • hors moyenne" : ""}
                          </p>
                        </div>
                        {subjectAvg !== null && (
                          <div className="text-right">
                            <p className={`font-mono text-lg font-semibold ${subjectAvg >= 10 ? "text-success" : "text-warning"}`}>
                              {subjectAvg.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{t("student.average")}</p>
                          </div>
                        )}
                      </div>

                      {/* Per-assessment marks (D1 / D2 / Examen per term) */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.rows.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-xs"
                          >
                            <span className="text-muted-foreground">T{a.term}</span>
                            <span className="font-mono">
                              {a.devoir1 != null ? a.devoir1.toFixed(2) : "—"} · {a.devoir2 != null ? a.devoir2.toFixed(2) : "—"} · {a.examen != null ? a.examen.toFixed(2) : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
