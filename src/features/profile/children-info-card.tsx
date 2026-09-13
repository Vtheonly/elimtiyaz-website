"use client";

/**
 * ChildrenInfoCard — per-child identity + enrollment details (T-210) with the
 * complete "Dossier de l'élève" dialog (T-329, 58th session).
 *
 * Owner mandate (32nd session, 2026-09-07): the portal did not show enough
 * detail about the parents' children — only name + student_code were
 * rendered. This card surfaces the full canonical `students` row (migration
 * 0005): date of birth + age, gender, grade level (academic_levels), class
 * (classes), enrollment date and enrollment status.
 *
 * Owner mandate (58th session, 2026-09-13 — the "personal and connected to
 * the parent's account and their children" requirement): every child gets a
 * "Dossier complet" action opening a dialog with:
 *   - Overview tab — identity + the medical/administrative notes the
 *     school recorded (students.medical_notes — the SAME column the desktop
 *     CRM edit-student-modal writes; not an internal-staff note surface),
 *   - History tab — student_academic_histories rows (migration
 *     0029, the CANONICAL academic-history table): previous years, decision
 *     (promoted/repeated/graduated/transferred), GPA, rank, narrative.
 *     Readable by parents under the 0091 parent-select policy.
 *   - Financial-enrollments tab — the StudentEnrollmentsCard (T-211).
 *
 * Data sources (Existing-Implementation-First — no new queries invented):
 *   - `useAuth().children` — StudentRow[] already fetched by the
 *     AuthProvider (selects `students.*`; RLS scopes to the signed-in
 *     parent via students_parent_sees_own, migration 0019).
 *   - `useAcademicLevels()` / `useClass(classId)` / `useStudentAcademicHistories()`
 *     — portal-queries hooks over the canonical tables.
 *
 * The card is read-only: enrollment and identity data is staff-controlled
 * (desktop CRM module); parents submit changes through the administration
 * channel (ADR-012 messenger).
 *
 * The per-child service/fee ENROLLMENTS live in the companion
 * StudentEnrollmentsCard (T-211) rendered inside the dossier dialog.
 *
 * T-329 i18n discipline: EVERY user-facing string goes through the
 * dictionary (fr/ar/en) — the 58th-session audit found ~20 hardcoded
 * French strings in the previous iteration of this file.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAcademicLevels, useClass, useStudentAcademicHistories, } from "@/lib/hooks/portal-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GraduationCap,
  Users,
  CalendarDays,
  FileText,
  UserCircle,
  Activity,
  BookOpen,
  AlertCircle,
  History,
  Stethoscope,
} from "lucide-react";
import { formatDate, formatFullName } from "@/lib/format";
import type { StudentRow } from "@/lib/types/database";
import { StudentEnrollmentsCard } from "@/features/profile/student-enrollments-card";
import { childLevelLabel, childClassLabel } from "@/features/students/child-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { PROMOTION_DECISION_LABELS_FR } from "@/lib/canonical/model/academic";
import { cn } from "@/lib/utils";

export const genderLabels: Record<string, string> = {
  male: "student.gender.male",
  female: "student.gender.female",
  other: "student.gender.other",
};

export const enrollmentStatusLabels: Record<string, string> = {
  inquiry: "student.status.inquiry",
  quoted: "student.status.quoted",
  enrolled: "student.status.enrolled",
  active: "student.status.active",
  withdrawn: "student.status.withdrawn",
  graduated: "student.status.graduated",
};

// T-210/T-213: shared with the dashboard child cards — exported so the
// enrollment status renders identically on every surface (one derivation).
/** Status pill tone — mirrors the financial view's status tone logic. */
export const enrollmentStatusTone: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  enrolled: "bg-info/15 text-info border-info/30",
  graduated: "bg-primary/15 text-primary border-primary/30",
  inquiry: "bg-muted text-muted-foreground border-border",
  quoted: "bg-warning/15 text-warning border-warning/30",
  withdrawn: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ChildrenInfoCard() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const levels = useAcademicLevels();

  if (kids.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">
          {t("children.title")}
        </h2>
      </div>

      {/* T-327/UI-305: base grid-cols-1 token (UI-300 rule) + the 2-column
          desktop step from the intentional-desktop-layout pass. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {kids.map((kid) => (
          <ChildIdentityCard
            key={kid.id}
            kid={kid}
            levels={levels.data ?? []}
          />
        ))}
      </div>
    </section>
  );
}

function ChildIdentityCard({
  kid,
  levels,
}: {
  kid: StudentRow;
  levels: ReturnType<typeof useAcademicLevels>["data"];
}) {
  const { t } = useT();
  const klass = useClass(kid.class_id);
  const [showDossier, setShowDossier] = useState(false);

  const levelLabel = childLevelLabel(levels, kid.grade_level_id);
  const classLabel = childClassLabel(klass.data);

  return (
    <>
      <Card
        className="border-border/60 bg-card shadow-sm flex flex-col h-full"
        data-testid={`child-card-${kid.id}`}
      >
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center text-primary ring-2 ring-background shadow-sm">
                <UserCircle className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">
                  {formatFullName(kid)}
                </CardTitle>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  {kid.student_code}
                </p>
              </div>
            </div>
            {kid.enrollment_status && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border",
                  enrollmentStatusTone[kid.enrollment_status] ??
                    "bg-muted text-muted-foreground border-border",
                )}
              >
                {t(
                  enrollmentStatusLabels[kid.enrollment_status] ??
                    "student.status.enrolled",
                )}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-5">
          <div className="grid grid-cols-1 gap-y-4 gap-x-2 text-sm mb-6 sm:grid-cols-2">
            <Detail
              label={t("student.level")}
              value={levelLabel}
              icon={<GraduationCap className="h-3.5 w-3.5 text-primary/70" />}
            />
            <Detail
              label={t("student.class")}
              value={classLabel}
              icon={<Users className="h-3.5 w-3.5 text-primary/70" />}
            />
            <Detail
              label={t("student.dateOfBirth")}
              value={kid.date_of_birth ? formatDate(kid.date_of_birth) : null}
              extra={
                kid.date_of_birth
                  ? `(${computeAge(kid.date_of_birth)} ${t("student.yearsOld")})`
                  : null
              }
            />
            <Detail
              label={t("student.gender")}
              value={
                kid.gender
                  ? t(genderLabels[kid.gender] ?? "student.gender.other")
                  : null
              }
            />
            <Detail
              label={t("student.enrollmentDate")}
              value={
                kid.enrollment_date ? formatDate(kid.enrollment_date) : null
              }
              icon={<CalendarDays className="h-3.5 w-3.5 text-primary/70" />}
            />
          </div>

          <div className="mt-auto pt-4 border-t border-border/40">
            <Button className="w-full" onClick={() => setShowDossier(true)}>
              <FileText className="mr-2 h-4 w-4" />
              {t("student.dossier.open")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <StudentDossierDialog
        kid={kid}
        levelLabel={levelLabel}
        classLabel={classLabel}
        open={showDossier}
        onOpenChange={setShowDossier}
      />
    </>
  );
}

function StudentDossierDialog({
  kid,
  levelLabel,
  classLabel,
  open,
  onOpenChange,
}: {
  kid: StudentRow;
  levelLabel: string | null;
  classLabel: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useT();
  const histories = useStudentAcademicHistories(kid.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <UserCircle className="h-8 w-8" />
            </div>
            <div>
              <DialogTitle className="text-2xl">
                {formatFullName(kid)}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium mt-1">
                {levelLabel ?? "—"} • {classLabel ?? t("student.noClass")} •{" "}
                <span className="font-mono">{kid.student_code}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          defaultValue="overview"
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* T-202/UI-303 idiom: multi-label tab row scrolls below sm. */}
          <div className="px-6 border-b border-border/60 bg-card">
            <TabsList className="bg-transparent space-x-2 h-12 w-full justify-start overflow-x-auto scrollbar-none">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 shrink-0"
              >
                <Activity className="h-4 w-4 mr-2" />{" "}
                {t("student.dossier.overview")}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 shrink-0"
              >
                <History className="h-4 w-4 mr-2" />{" "}
                {t("student.history.title")}
              </TabsTrigger>
              <TabsTrigger
                value="enrollments"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 shrink-0"
              >
                <BookOpen className="h-4 w-4 mr-2" />{" "}
                {t("student.dossier.enrollments")}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
            <TabsContent value="overview" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />{" "}
                    {t("student.dossier.identity")}
                  </h3>
                  <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3 shadow-sm">
                    <DossierRow label={t("student.code")} value={kid.student_code} mono />
                    <DossierRow
                      label={t("student.level")}
                      value={levelLabel ?? "—"}
                    />
                    <DossierRow
                      label={t("student.class")}
                      value={classLabel ?? "—"}
                    />
                    <DossierRow
                      label={t("student.gender")}
                      value={
                        kid.gender
                          ? t(genderLabels[kid.gender] ?? "student.gender.other")
                          : "—"
                      }
                    />
                    <DossierRow
                      label={t("student.dateOfBirth")}
                      value={
                        kid.date_of_birth ? formatDate(kid.date_of_birth) : "—"
                      }
                    />
                    <DossierRow
                      label={t("student.age")}
                      value={
                        kid.date_of_birth
                          ? `${computeAge(kid.date_of_birth)} ${t("student.yearsOld")}`
                          : "—"
                      }
                    />
                    <DossierRow
                      label={t("student.enrollmentDate")}
                      value={
                        kid.enrollment_date
                          ? formatDate(kid.enrollment_date)
                          : "—"
                      }
                      last
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />{" "}
                    {t("student.notes.title")}
                  </h3>
                  <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm min-h-[160px]">
                    {kid.medical_notes ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {kid.medical_notes}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p className="text-sm">{t("student.notes.empty")}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                {t("student.history.previousYears")}
              </h3>
              {histories.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : histories.data && histories.data.length > 0 ? (
                <div className="space-y-4 border-l-2 border-primary/30 ml-3 pl-6 relative">
                  {histories.data.map((h) => {
                    const isPromoted =
                      h.decision === "promoted" || h.decision === "graduated";
                    return (
                      <div key={h.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[35px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background",
                            isPromoted ? "bg-success" : "bg-warning",
                          )}
                        />
                        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm hover:border-primary/30 transition-colors">
                          <div className="flex flex-wrap justify-between items-start gap-4 mb-3 border-b border-border/40 pb-3">
                            <div>
                              <p className="font-bold text-lg text-primary">
                                {h.academic_year}
                              </p>
                              <p className="text-sm font-medium">
                                {h.class_name ?? h.grade_code}
                              </p>
                            </div>
                            <div className="text-right">
                              <span
                                className={cn(
                                  "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                  isPromoted
                                    ? "bg-success/15 text-success"
                                    : "bg-warning/15 text-warning",
                                )}
                              >
                                {PROMOTION_DECISION_LABELS_FR[h.decision] ??
                                  h.decision}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-6 text-sm mb-3 bg-muted/20 p-3 rounded-lg">
                            <div>
                              <span className="text-muted-foreground block text-xs uppercase">
                                {t("student.gpa")}
                              </span>
                              <span className="font-mono font-bold text-lg">
                                {h.gpa.toFixed(2)}
                              </span>
                            </div>
                            {h.rank && (
                              <div>
                                <span className="text-muted-foreground block text-xs uppercase">
                                  {t("student.rank")}
                                </span>
                                <span className="font-mono font-bold text-lg">
                                  {h.rank}
                                </span>
                              </div>
                            )}
                          </div>

                          {h.narrative && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">
                                {t("student.appreciation")}
                              </p>
                              <p className="text-sm italic border-l-2 border-muted pl-3">
                                {h.narrative}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-card border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-lg">
                    {t("student.history.empty")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("student.history.firstYear")}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="enrollments" className="mt-0">
              <div className="bg-card border border-border/60 rounded-xl p-1 shadow-sm">
                <StudentEnrollmentsCard studentId={kid.id} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DossierRow({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 py-1 border-b border-border/40",
        last && "border-b-0",
      )}
    >
      <span className="text-muted-foreground text-sm shrink-0">{label}</span>
      <span
        className={cn(
          "font-medium text-sm text-right",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Detail({
  label,
  value,
  extra,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  extra?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground flex items-center gap-1.5 mb-0.5">
        {icon} {label}
      </dt>
      <dd className="truncate font-medium text-foreground">
        {value || "—"}
        {value && extra ? (
          <span className="ml-1.5 font-normal text-muted-foreground">
            {extra}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export function computeAge(dateOfBirth: string): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}
