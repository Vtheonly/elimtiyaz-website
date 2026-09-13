"use client";

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import {
  useAcademicLevels,
  useClass,
  useStudentAcademicHistories,
} from "@/lib/hooks/portal-queries";
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
import {
  childLevelLabel,
  childClassLabel,
} from "@/features/students/child-summary";
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm mb-6">
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
          </div>

          <div className="mt-auto pt-4 border-t border-border/40">
            <Button className="w-full" onClick={() => setShowDossier(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Dossier complet de l'élève
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
                {levelLabel} • {classLabel ?? "Aucune classe assignée"} •{" "}
                <span className="font-mono">{kid.student_code}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          defaultValue="overview"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 border-b border-border/60 bg-card">
            <TabsList className="bg-transparent space-x-2 h-12 w-full justify-start overflow-x-auto">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4"
              >
                <Activity className="h-4 w-4 mr-2" /> Vue d'ensemble
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4"
              >
                <History className="h-4 w-4 mr-2" /> Historique Scolaire
              </TabsTrigger>
              <TabsTrigger
                value="enrollments"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4"
              >
                <BookOpen className="h-4 w-4 mr-2" /> Inscriptions Financières
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
            <TabsContent value="overview" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <UserCircle className="h-4 w-4" /> Identité
                  </h3>
                  <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground text-sm">
                        Sexe
                      </span>
                      <span className="font-medium text-sm">
                        {kid.gender
                          ? t(
                              genderLabels[kid.gender] ??
                                "student.gender.other",
                            )
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground text-sm">
                        Date de naissance
                      </span>
                      <span className="font-medium text-sm">
                        {kid.date_of_birth
                          ? formatDate(kid.date_of_birth)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground text-sm">Âge</span>
                      <span className="font-medium text-sm">
                        {kid.date_of_birth
                          ? `${computeAge(kid.date_of_birth)} ans`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground text-sm">
                        Date d'inscription
                      </span>
                      <span className="font-medium text-sm">
                        {kid.enrollment_date
                          ? formatDate(kid.enrollment_date)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" /> Notes Médicales &
                    Observations
                  </h3>
                  <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm min-h-[160px]">
                    {kid.medical_notes ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {kid.medical_notes}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p className="text-sm">
                          Aucune note médicale ou observation enregistrée.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Années précédentes
              </h3>
              {histories.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Chargement de l'historique...
                </p>
              ) : histories.data && histories.data.length > 0 ? (
                <div className="space-y-4 border-l-2 border-primary/30 ml-3 pl-6 relative">
                  {histories.data.map((h, i) => {
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
                                Moyenne Générale
                              </span>
                              <span className="font-mono font-bold text-lg">
                                {h.gpa.toFixed(2)}
                              </span>
                            </div>
                            {h.rank && (
                              <div>
                                <span className="text-muted-foreground block text-xs uppercase">
                                  Rang
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
                                Appréciation / Bilan
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
                    Aucun historique scolaire
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    C'est probablement la première année de l'élève dans
                    l'établissement.
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
