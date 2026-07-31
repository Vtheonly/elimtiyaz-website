"use client";

/**
 * DashboardView — the parent's home screen.
 *
 * Shows (mobile-first vertical feed):
 *   1. Greeting + parent name
 *   2. KPI grid: balance due, next installment, attendance rate, average grade
 *   3. Children list (with quick links to per-child views)
 *   4. Upcoming events (exams, deadlines)
 *   5. Recent announcements
 *   6. Recent payments
 *
 * All data comes from Supabase via RLS-protected queries. If a query returns
 * empty, we render an EmptyState instead of a blank section.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import {
  useInstallments,
  usePayments,
  useNotifications,
  useUpcomingEvents,
  useAttendanceForStudent,
  useGradesForStudent,
} from "@/lib/hooks/portal-queries";
import {
  useNotificationsRealtime,
  useFinancialRealtime,
} from "@/lib/hooks/use-realtime";
import { KpiCard } from "@/features/shared/kpi-card";
import { StatusPill } from "@/features/shared/status-pill";
import {
  SectionHeader,
  EmptyState,
  CardListItem,
  KpiSkeleton,
  ListSkeleton,
  ErrorState,
} from "@/features/shared/state-views";
import { PullToRefresh } from "@/features/shared/pull-to-refresh";
import { StudentSwitcher } from "@/features/students/student-switcher";
import {
  Wallet,
  CalendarClock,
  GraduationCap,
  MessageSquare,
  ChevronRight,
  CalendarDays,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatFullName,
  formatRelative,
  daysUntil,
} from "@/lib/format";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const { t } = useT();
  const { parent, children: kids, user } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);

  // Realtime: refresh notifications + financial data when the backend changes.
  useNotificationsRealtime();
  useFinancialRealtime(parent?.id ?? null);

  const activeKid = kids.find((k) => k.id === activeStudentId) ?? kids[0] ?? null;

  // KPI data
  const installments = useInstallments(parent?.id ?? null, { limit: 50 });
  const payments = usePayments(parent?.id ?? null, { limit: 5 });
  const events = useUpcomingEvents({ limit: 5 });
  const announcements = useNotifications(user?.id ?? null, { limit: 5 });
  const attendance = useAttendanceForStudent(activeKid?.id ?? null, { limit: 100 });
  const grades = useGradesForStudent(activeKid?.id ?? null);

  // Compute balance due = sum of (amount_due - amount_paid) for installments
  const balanceDue = useMemo(() => {
    if (!installments.data) return 0;
    return installments.data.reduce((sum, i) => {
      const remaining = Math.max(0, i.amount_due - i.amount_paid);
      return sum + remaining;
    }, 0);
  }, [installments.data]);

  // Next upcoming installment (earliest unpaid)
  const nextInstallment = useMemo(() => {
    if (!installments.data) return null;
    const unpaid = installments.data
      .filter((i) => i.status !== "paid")
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return unpaid[0] ?? null;
  }, [installments.data]);

  // Attendance rate for active student
  const attendanceRate = useMemo(() => {
    if (!attendance.data || attendance.data.length === 0) return null;
    const present = attendance.data.filter((a) => a.status === "present").length;
    return Math.round((present / attendance.data.length) * 100);
  }, [attendance.data]);

  // Average grade for active student (simple mean of subject_average)
  const averageGrade = useMemo(() => {
    if (!grades.data || grades.data.length === 0) return null;
    const valid = grades.data
      .map((g) => g.subject_average ?? g.score)
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (valid.length === 0) return null;
    return valid.reduce((s, v) => s + v, 0) / valid.length;
  }, [grades.data]);

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "dashboard.greeting.morning" : hour < 18 ? "dashboard.greeting.afternoon" : "dashboard.greeting.evening";

  const handleRefresh = async () => {
    await Promise.all([
      installments.refetch(),
      payments.refetch(),
      events.refetch(),
      announcements.refetch(),
      attendance.refetch(),
      grades.refetch(),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
        {/* Greeting */}
        <div>
        <p className="text-sm text-muted-foreground">{t(greetingKey)}</p>
        <h1 className="mt-0.5 text-xl font-semibold">
          {parent ? `${parent.first_name} ${parent.last_name}` : t("app.name")}
        </h1>
      </div>

      {/* KPI grid */}
      {installments.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : installments.isError ? (
        <ErrorState title={t("common.error.title")} description={t("common.error.network")} onRetry={() => installments.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label={t("kpi.balanceDue")}
            value={formatCurrency(balanceDue)}
            tone={balanceDue > 0 ? "danger" : "success"}
            icon={<Wallet className="h-5 w-5" />}
            hint={balanceDue > 0 ? t("finance.balance.outstanding") : t("finance.balance.settled")}
            onClick={() => setActiveView("finance")}
          />
          <KpiCard
            label={t("kpi.nextInstallment")}
            value={nextInstallment ? formatCurrency(nextInstallment.amount_due - nextInstallment.amount_paid) : "—"}
            tone={nextInstallment ? (daysUntil(nextInstallment.due_date) < 0 ? "danger" : "info") : "success"}
            icon={<CalendarClock className="h-5 w-5" />}
            hint={nextInstallment ? formatDate(nextInstallment.due_date) : t("finance.empty.noInstallments")}
            onClick={() => setActiveView("finance")}
          />
          <KpiCard
            label={t("kpi.attendanceRate")}
            value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
            tone={(attendanceRate ?? 0) >= 90 ? "success" : (attendanceRate ?? 0) >= 75 ? "warning" : "danger"}
            icon={<GraduationCap className="h-5 w-5" />}
            hint={activeKid ? formatFullName(activeKid) : t("dashboard.empty.noChildren")}
            onClick={() => setActiveView("attendance")}
          />
          <KpiCard
            label={t("kpi.averageGrade")}
            value={averageGrade !== null ? averageGrade.toFixed(2) : "—"}
            tone={(averageGrade ?? 0) >= 10 ? "success" : "warning"}
            icon={<GraduationCap className="h-5 w-5" />}
            hint={activeKid ? formatFullName(activeKid) : t("dashboard.empty.noChildren")}
            onClick={() => setActiveView("academic")}
          />
        </div>
      )}

      {/* Children */}
      {kids.length > 1 && (
        <section className="space-y-3">
          <SectionHeader title={t("dashboard.section.children")} />
          <StudentSwitcher />
        </section>
      )}

      {/* Two-column layout on desktop */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming events */}
        <section className="space-y-3">
          <SectionHeader
            title={t("dashboard.section.upcoming")}
            action={
              <button
                onClick={() => setActiveView("calendar")}
                className="text-xs text-primary hover:underline"
              >
                {t("dashboard.viewAll")}
              </button>
            }
          />
          {events.isLoading ? (
            <ListSkeleton count={3} />
          ) : events.data && events.data.length > 0 ? (
            <div className="space-y-2">
              {events.data.map((ev) => (
                <CardListItem
                  key={ev.id}
                  leading={
                    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-info/10 text-info">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                  }
                  title={ev.title}
                  subtitle={`${formatDate(ev.start_at, { withTime: !ev.all_day })}${ev.location ? ` • ${ev.location}` : ""}`}
                  trailing={
                    <StatusPill tone={ev.event_type === "exam" ? "danger" : "info"}>
                      {ev.event_type}
                    </StatusPill>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("dashboard.empty.noUpcoming")}
              icon={<CalendarDays className="h-6 w-6" />}
            />
          )}
        </section>

        {/* Announcements */}
        <section className="space-y-3">
          <SectionHeader
            title={t("dashboard.section.announcements")}
            action={
              <button
                onClick={() => setActiveView("notifications")}
                className="text-xs text-primary hover:underline"
              >
                {t("dashboard.viewAll")}
              </button>
            }
          />
          {announcements.isLoading ? (
            <ListSkeleton count={3} />
          ) : announcements.data && announcements.data.length > 0 ? (
            <div className="space-y-2">
              {announcements.data.slice(0, 4).map((n) => (
                <CardListItem
                  key={n.id}
                  leading={
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        n.priority === "urgent"
                          ? "bg-destructive/15 text-destructive"
                          : n.priority === "high"
                            ? "bg-warning/15 text-warning"
                            : "bg-info/15 text-info"
                      )}
                    >
                      {n.priority === "urgent" ? <AlertTriangle className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    </div>
                  }
                  title={n.title}
                  subtitle={n.body ?? formatRelative(n.triggered_at)}
                  trailing={
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(n.triggered_at)}
                    </span>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("dashboard.empty.noAnnouncements")}
              icon={<MessageSquare className="h-6 w-6" />}
            />
          )}
        </section>
      </div>

      {/* Recent payments */}
      <section className="space-y-3">
        <SectionHeader
          title={t("dashboard.section.recent")}
          action={
            <button
              onClick={() => setActiveView("finance")}
              className="text-xs text-primary hover:underline"
            >
              {t("dashboard.viewAll")}
            </button>
          }
        />
        {payments.isLoading ? (
          <ListSkeleton count={3} />
        ) : payments.data && payments.data.length > 0 ? (
          <div className="space-y-2">
            {payments.data.map((p) => (
              <CardListItem
                key={p.id}
                leading={
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                    <Receipt className="h-4 w-4" />
                  </div>
                }
                title={formatCurrency(p.amount)}
                subtitle={`${t(`finance.payment.method.${p.method}`)} • ${formatDate(p.collected_at)}`}
                trailing={
                  <StatusPill tone="success">{t("finance.status.paid")}</StatusPill>
                }
                onClick={() => setActiveView("finance")}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t("finance.empty.noPayments")}
            icon={<Receipt className="h-6 w-6" />}
          />
        )}
      </section>

      {/* Children cards (when only 1, show full profile card; multi handled above) */}
      {kids.length === 1 && activeKid && (
        <section className="space-y-3">
          <SectionHeader title={t("dashboard.section.children")} />
          <Card
            className="cursor-pointer border-border/60 card-hover"
            onClick={() => {
              setActiveStudentId(activeKid.id);
              setActiveView("academic");
            }}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{formatFullName(activeKid)}</p>
                <p className="text-xs text-muted-foreground">
                  {activeKid.student_code}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </section>
      )}
      </div>
    </PullToRefresh>
  );
}
