"use client";

/**
 * CalendarView — month grid + upcoming events + exam timetable.
 *
 * Per the Client Web Portal plan (Entire_Project_Plan.txt → "05. Client Web Portal"):
 *   - "Exam Timetable — Dates, Rooms, Invigilators"
 *   - Calendar shows events relevant to the parent's children
 *
 * Layout (mobile-first):
 *   1. Month grid (7 columns × 6 rows) with event dots
 *   2. Selected day's events list below
 *   3. Filter chips by event_type
 *   4. "Upcoming exams" section with room + invigilator
 */

import { useT } from "@/lib/i18n/use-t";
import { useAuth } from "@/app/providers/auth-provider";
import { useAppStore } from "@/lib/store/app-store";
import { useUpcomingEvents } from "@/lib/hooks/portal-queries";
import {
  SectionHeader,
  EmptyState,
  ListSkeleton,
  ErrorState,
  CardListItem,
} from "@/features/shared/state-views";
import { StatusPill } from "@/features/shared/status-pill";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  User as UserIcon,
  Clock,
  GraduationCap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { CalendarEventRow } from "@/lib/types/database";

const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const eventTypeTone: Record<string, "danger" | "info" | "warning" | "success"> = {
  exam: "danger",
  holiday: "success",
  meeting: "info",
  deadline: "warning",
  activity: "info",
  other: "info",
};

const eventTypeColor: Record<string, string> = {
  exam: "bg-destructive",
  holiday: "bg-success",
  meeting: "bg-info",
  deadline: "bg-warning",
  activity: "bg-info",
  other: "bg-muted-foreground",
};

export function CalendarView() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);

  const events = useUpcomingEvents({ limit: 200 });

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    if (!events.data) return map;
    for (const ev of events.data) {
      const dateKey = ev.start_at.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(ev);
    }
    return map;
  }, [events.data]);

  const selectedDayEvents = useMemo(() => {
    const all = eventsByDate.get(selectedDate) ?? [];
    if (activeFilter === "all") return all;
    return all.filter((e) => e.event_type === activeFilter);
  }, [eventsByDate, selectedDate, activeFilter]);

  const upcomingExams = useMemo(() => {
    if (!events.data) return [];
    const classId = activeKid?.class_id ?? null;
    return events.data
      .filter((e) => e.event_type === "exam")
      .filter((e) => {
        if (!classId) return true;
        return e.target_class_id === null || e.target_class_id === classId;
      })
      .slice(0, 10);
  }, [events.data, activeKid]);

  const prevMonth = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now.toISOString().slice(0, 10));
  };

  const filterTypes = ["all", "exam", "holiday", "meeting", "deadline", "activity"];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("calendar.title")}</h1>
        <button
          onClick={goToday}
          className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/40"
        >
          {t("calendar.today")}
        </button>
      </div>

      {/* Month grid */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={prevMonth}
              aria-label={t("calendar.prevMonth")}
              className="touch-target flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted/40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold">
              {MONTHS_FR[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
            <button
              onClick={nextMonth}
              aria-label={t("calendar.nextMonth")}
              className="touch-target flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted/40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
            {WEEKDAYS_FR.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, idx) => {
              const dateKey = day.date.toISOString().slice(0, 10);
              const dayEvents = eventsByDate.get(dateKey) ?? [];
              const isSelected = dateKey === selectedDate;
              const isToday = dateKey === new Date().toISOString().slice(0, 10);
              const isCurrentMonth = day.isCurrentMonth;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateKey)}
                  className={cn(
                    "relative aspect-square rounded-lg border p-1 text-xs transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : isCurrentMonth
                        ? "border-border/40 bg-card hover:bg-muted/40"
                        : "border-transparent text-muted-foreground/50",
                    isToday && !isSelected && "ring-1 ring-primary/40"
                  )}
                >
                  <span className="font-medium">{day.date.getDate()}</span>
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <span
                          key={i}
                          className={cn("h-1 w-1 rounded-full", eventTypeColor[e.event_type] ?? "bg-muted-foreground")}
                          aria-hidden
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {filterTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeFilter === type
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/40"
            )}
          >
            {type === "all" ? t("calendar.filterAll") : t(`calendar.eventType.${type}`)}
          </button>
        ))}
      </div>

      {/* Selected day events */}
      <section className="space-y-3">
        <SectionHeader title={`${formatDate(selectedDate)} • ${selectedDayEvents.length}`} />
        {events.isLoading ? (
          <ListSkeleton count={3} />
        ) : events.isError ? (
          <ErrorState title={t("common.error.title")} onRetry={() => events.refetch()} />
        ) : selectedDayEvents.length > 0 ? (
          <div className="space-y-2">
            {selectedDayEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        ) : (
          <EmptyState title={t("calendar.noEvents")} icon={<CalendarDays className="h-6 w-6" />} />
        )}
      </section>

      {/* Upcoming exams */}
      <section className="space-y-3">
        <SectionHeader title={t("calendar.exam.title")} />
        {upcomingExams.length > 0 ? (
          <div className="space-y-2">
            {upcomingExams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        ) : (
          <EmptyState title={t("calendar.exam.empty")} icon={<GraduationCap className="h-6 w-6" />} />
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function EventCard({ ev }: { ev: CalendarEventRow }) {
  const { t } = useT();
  const tone = eventTypeTone[ev.event_type] ?? "info";
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              tone === "danger" ? "bg-destructive/15 text-destructive"
                : tone === "success" ? "bg-success/15 text-success"
                : tone === "warning" ? "bg-warning/15 text-warning"
                : "bg-info/15 text-info"
            )}
          >
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{ev.title}</p>
              <StatusPill tone={tone}>{t(`calendar.eventType.${ev.event_type}`)}</StatusPill>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {ev.all_day ? t("calendar.allDay") : formatDate(ev.start_at, { withTime: true })}
              </span>
              {ev.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {ev.location}
                </span>
              )}
            </div>
            {ev.description && (
              <p className="mt-2 text-sm text-muted-foreground">{ev.description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function ExamCard({ exam }: { exam: CalendarEventRow }) {
  const { t } = useT();
  return (
    <CardListItem
      leading={
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
          <GraduationCap className="h-4 w-4" />
        </div>
      }
      title={exam.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(exam.start_at, { withTime: !exam.all_day })}
          </span>
          {exam.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {t("calendar.exam.room")}: {exam.location}
            </span>
          )}
          {exam.created_by && (
            <span className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {t("calendar.exam.invigilator")}
            </span>
          )}
        </span>
      }
      trailing={<StatusPill tone="danger">{t("calendar.eventType.exam")}</StatusPill>}
    />
  );
}

/* -------------------------------------------------------------------------- */

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
}

function buildMonthGrid(cursor: Date): DayCell[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const dayOfWeek = (first.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(first);
  start.setDate(first.getDate() - dayOfWeek);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      isCurrentMonth: d.getMonth() === cursor.getMonth(),
    });
  }
  return cells;
}
