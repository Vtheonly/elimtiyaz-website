"use client";

/**
 * ChildrenInfoCard — per-child identity + enrollment details (T-210).
 *
 * Owner mandate (32nd session, 2026-09-07): the portal did not show enough
 * detail about the parents' children — only name + student_code were
 * rendered (dashboard child card / student switcher). This card surfaces
 * the full canonical `students` row (migration 0005): date of birth + age,
 * gender, grade level (academic_levels), class (classes), enrollment date
 * and enrollment status.
 *
 * Data sources (Existing-Implementation-First — no new queries invented):
 *   - `useAuth().children` — StudentRow[] already fetched by the
 *     AuthProvider (selects `students.*`; RLS scopes to the signed-in
 *     parent via students_parent_sees_own, migration 0019).
 *   - `useAcademicLevels()` — portal-queries hook over academic_levels.
 *   - `useClass(classId)` — portal-queries hook over classes.
 *
 * The card is read-only: enrollment and identity data is staff-controlled
 * (desktop CRM module); parents submit changes through the administration
 * channel (ADR-012 messenger).
 *
 * The per-child service/fee ENROLLMENTS live in the companion
 * StudentEnrollmentsCard (T-211) rendered below each child's identity
 * section.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import {
  useAcademicLevels,
  useClass,
} from "@/lib/hooks/portal-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, GraduationCap, Users } from "lucide-react";
import { formatDate, formatFullName } from "@/lib/format";
import type { StudentRow } from "@/lib/types/database";
import { StudentEnrollmentsCard } from "@/features/profile/student-enrollments-card";

const genderLabels: Record<string, string> = {
  male: "student.gender.male",
  female: "student.gender.female",
  other: "student.gender.other",
};

const enrollmentStatusLabels: Record<string, string> = {
  inquiry: "student.status.inquiry",
  quoted: "student.status.quoted",
  enrolled: "student.status.enrolled",
  active: "student.status.active",
  withdrawn: "student.status.withdrawn",
  graduated: "student.status.graduated",
};

/** Status pill tone — mirrors the financial view's status tone logic. */
const enrollmentStatusTone: Record<string, string> = {
  active: "bg-success/15 text-success",
  enrolled: "bg-info/15 text-info",
  graduated: "bg-primary/15 text-primary",
  inquiry: "bg-muted text-muted-foreground",
  quoted: "bg-warning/15 text-warning",
  withdrawn: "bg-destructive/15 text-destructive",
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
        <h2 className="text-base font-semibold">{t("children.title")}</h2>
      </div>

      {kids.map((kid) => (
        <ChildIdentityCard key={kid.id} kid={kid} levels={levels.data ?? []} />
      ))}
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

  const level = levels?.find((l) => l.id === kid.grade_level_id) ?? null;
  // Live values: year_label "1ère Année Primaire" + grade_code "1ap" —
  // join both when present, either alone otherwise (bulletin parity).
  const levelLabel = level
    ? [level.year_label, level.grade_code].filter(Boolean).join(" · ") || null
    : null;
  const classLabel = klass.data
    ? [klass.data.name ?? klass.data.code, klass.data.room].filter(Boolean).join(" · ")
    : null;

  return (
    <Card className="border-border/60" data-testid={`child-card-${kid.id}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {formatFullName(kid)}
          </span>
          {kid.enrollment_status && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold normal-case ${
                enrollmentStatusTone[kid.enrollment_status] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {t(
                enrollmentStatusLabels[kid.enrollment_status] ?? "student.status.enrolled",
              )}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label={t("student.code")} value={kid.student_code} mono />
          <Detail
            label={t("student.level")}
            value={levelLabel}
          />
          <Detail
            label={t("student.class")}
            value={classLabel}
          />
          <Detail
            label={t("student.dateOfBirth")}
            value={kid.date_of_birth ? formatDate(kid.date_of_birth) : null}
            extra={kid.date_of_birth ? `(${computeAge(kid.date_of_birth)} ${t("student.yearsOld")})` : null}
          />
          <Detail
            label={t("student.gender")}
            value={kid.gender ? t(genderLabels[kid.gender] ?? "student.gender.other") : null}
          />
          <Detail
            label={t("student.enrollmentDate")}
            value={kid.enrollment_date ? formatDate(kid.enrollment_date) : null}
          />
        </dl>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {t("children.identityNote")}
        </div>
      </CardContent>

      {/* T-211: the child's service enrollments + per-student fee schedule. */}
      <StudentEnrollmentsCard studentId={kid.id} />
    </Card>
  );
}

function Detail({
  label,
  value,
  extra,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  extra?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
        {value && extra ? <span className="ml-1 font-normal text-muted-foreground">{extra}</span> : null}
      </dd>
    </div>
  );
}

/** Age in whole years from a YYYY-MM-DD date (server date, not timestamp). */
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
