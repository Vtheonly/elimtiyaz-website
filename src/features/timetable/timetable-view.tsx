"use client";

/**
 * TimetableView — the child's published weekly schedule (Emploi du temps).
 *
 * T-408 (SCHED-106): the portal consumed NOTHING of the canonical timetable
 * before this view — migration 0110 had exposed published versions to
 * tenant-authenticated accounts and 0113 §4 added the
 * v_timetable_published projection (denormalized names, parents cannot
 * SELECT personnel/rooms under RLS). This view renders exactly that
 * projection: the Algerian school week (Sunday → Thursday, SCHED-102 —
 * Friday and Saturday are the weekend) with the configured periods.
 *
 * Read-only by design: parents see what the school PUBLISHED. Drafts and
 * trials never appear (published-only join, 0109/0110 RLS).
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import { usePublishedTimetable, useClass } from "@/lib/hooks/portal-queries";
import { StudentSwitcherDropdown } from "@/features/students/student-switcher";
import {
  EmptyState,
  ListSkeleton,
  ErrorState,
} from "@/features/shared/state-views";
import { Card, CardContent } from "@/components/ui/card";
import type { TimetablePublishedRow } from "@/lib/types/database";
import { CalendarDays, Clock, MapPin, User } from "lucide-react";
import { useMemo } from "react";

/** The Algerian school week — Sunday → Thursday (SCHED-102). */
const ALGERIAN_WEEK: ReadonlyArray<TimetablePublishedRow["day"]> = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
];

const DAY_KEYS: Record<TimetablePublishedRow["day"], string> = {
  sunday: "timetable.day.sunday",
  monday: "timetable.day.monday",
  tuesday: "timetable.day.tuesday",
  wednesday: "timetable.day.wednesday",
  thursday: "timetable.day.thursday",
  friday: "timetable.day.friday",
  saturday: "timetable.day.saturday",
};

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TimetableView() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);

  const klass = useClass(activeKid?.class_id ?? null);
  const timetable = usePublishedTimetable(activeKid?.class_id ?? null);

  // Group by day → period. Periods are derived from the entries themselves
  // (the published rows carry start/end minutes) — no hardcoded bell
  // schedule on the portal.
  const byDay = useMemo(() => {
    const map = new Map<
      TimetablePublishedRow["day"],
      Map<number, TimetablePublishedRow[]>
    >();
    for (const entry of timetable.data ?? []) {
      const day =
        map.get(entry.day) ?? new Map<number, TimetablePublishedRow[]>();
      const list = day.get(entry.period_index) ?? [];
      list.push(entry);
      day.set(entry.period_index, list);
      map.set(entry.day, day);
    }
    return map;
  }, [timetable.data]);

  const hasData = (timetable.data?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="min-w-0 text-xl font-semibold">{t("nav.timetable")}</h1>
        {kids.length > 1 && <StudentSwitcherDropdown />}
      </div>

      {/* Active student + class banner */}
      {activeKid && (
        <Card className="border-border/60 bg-card/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {activeKid.first_name} {activeKid.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {klass.data?.name ?? klass.data?.code ?? activeKid.student_code}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {timetable.isLoading ? (
        <ListSkeleton count={4} />
      ) : timetable.isError ? (
        <ErrorState
          title={t("common.error.title")}
          onRetry={() => timetable.refetch()}
        />
      ) : !activeKid ? (
        <EmptyState
          title={t("academic.noStudent")}
          icon={<CalendarDays className="h-6 w-6" />}
        />
      ) : !activeKid.class_id ? (
        <EmptyState
          title={t("student.noClass")}
          icon={<CalendarDays className="h-6 w-6" />}
        />
      ) : !hasData ? (
        <EmptyState
          title={t("timetable.empty")}
          icon={<CalendarDays className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-4">
          {/* Weekly list: one card per school day, periods in order. */}
          {ALGERIAN_WEEK.filter((day) => byDay.has(day)).map((day) => {
            const periods = byDay.get(day)!;
            return (
              <Card key={day} className="border-border/60">
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-semibold">
                    {t(DAY_KEYS[day])}
                  </p>
                  <div className="space-y-2">
                    {[...periods.keys()]
                      .sort((a, b) => a - b)
                      .map((periodIndex) =>
                        (periods.get(periodIndex) ?? []).map((entry, i) => (
                          <div
                            key={`${entry.id}-${i}`}
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/40 bg-muted/30 px-3 py-2"
                          >
                            <span className="min-w-[46px] font-mono text-xs font-semibold text-primary">
                              {t("timetable.period", { index: entry.period_index })}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              {minutesToHHMM(entry.start_minutes)}–
                              {minutesToHHMM(entry.end_minutes)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {entry.subject_name_fr}
                              {entry.subject_name_ar ? (
                                <span className="ms-2 text-xs text-muted-foreground">
                                  {entry.subject_name_ar}
                                </span>
                              ) : null}
                            </span>
                            {entry.teacher_name && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3.5 w-3.5" />
                                {entry.teacher_name}
                              </span>
                            )}
                            {entry.room_label && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {entry.room_label}
                              </span>
                            )}
                            {entry.lesson_group > 1 && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {t("timetable.double")}
                              </span>
                            )}
                          </div>
                        )),
                      )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <p className="text-[11px] italic text-muted-foreground">
            {t("timetable.publishedHint")}
          </p>
        </div>
      )}
    </div>
  );
}
