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
import { useGradesForStudent, useClass, useAttendanceForStudent, useAcademicLevels } from "@/lib/hooks/portal-queries";
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

type Term = 1 | 2 | 3;

export function AcademicView() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);

  const grades = useGradesForStudent(activeKid?.id ?? null);
  const klass = useClass(activeKid?.class_id ?? null);
  const attendance = useAttendanceForStudent(activeKid?.id ?? null, { limit: 500 });
  const levels = useAcademicLevels();

  const [activeTerm, setActiveTerm] = useState<Term | "all">("all");

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

  // Group grades by subject (using class_subject.subject)
  const bySubject = useMemo(() => {
    if (!grades.data) return new Map<string, { subjectName: string; coefficient: number; grades: GradeRow[] }>();
    const map = new Map<string, { subjectName: string; coefficient: number; grades: GradeRow[] }>();
    for (const g of grades.data) {
      const cs = g.assessment?.class_subject;
      const subj = cs?.subject;
      const key = cs?.subject_id ?? "unknown";
      const existing = map.get(key);
      if (existing) {
        existing.grades.push(g);
      } else {
        map.set(key, {
          subjectName: subj?.name_fr ?? subj?.name_en ?? "—",
          coefficient: cs?.coefficient ?? subj?.default_coefficient ?? 1,
          grades: [g],
        });
      }
    }
    return map;
  }, [grades.data]);

  // Overall average = sum(subject_average * coefficient) / sum(coefficient)
  const overall = useMemo(() => {
    let num = 0;
    let denom = 0;
    bySubject.forEach((s) => {
      const valid = s.grades.map((g) => g.subject_average ?? g.score).filter((v): v is number => typeof v === "number");
      if (valid.length === 0) return;
      const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
      num += avg * s.coefficient;
      denom += s.coefficient;
    });
    return denom > 0 ? num / denom : null;
  }, [bySubject]);

  const filteredSubjects = useMemo(() => {
    if (activeTerm === "all") return bySubject;
    const m = new Map<string, { subjectName: string; coefficient: number; grades: GradeRow[] }>();
    bySubject.forEach((s, key) => {
      const filtered = s.grades.filter((g) => g.assessment?.term === activeTerm);
      if (filtered.length > 0) m.set(key, { ...s, grades: filtered });
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
            tone={(overall ?? 0) >= 10 ? "success" : "warning"}
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
      <Tabs value={activeTerm} onValueChange={(v) => setActiveTerm(v as Term | "all")}>
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
                const valid = s.grades
                  .map((g) => g.subject_average ?? g.score)
                  .filter((v): v is number => typeof v === "number");
                const subjectAvg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
                return (
                  <Card key={subjectId} className="border-border/50 bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{s.subjectName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("student.coefficient")}: {s.coefficient}
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

                      {/* Per-assessment grades */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.grades.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {g.assessment?.kind === "devoir_1" ? "D1" : g.assessment?.kind === "devoir_2" ? "D2" : g.assessment?.kind === "examen" ? "Exam" : "—"}
                            </span>
                            <span className="font-mono font-semibold">{g.score.toFixed(2)}</span>
                            <span className="text-muted-foreground">/ {g.assessment?.max_score ?? 20}</span>
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
