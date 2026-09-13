"use client";

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import {
  useInstallments,
  usePayments,
  useNotifications,
  useUpcomingEvents,
  useLedgerEntries,
  useAcademicLevels,
  useClass,
} from "@/lib/hooks/portal-queries";
import {
  installmentRemainingAmount,
  portalFinancialSummary,
} from "@/lib/canonical/portal-derive";
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
import { childLevelClassLine } from "@/features/students/child-summary";
import {
  enrollmentStatusLabels,
  enrollmentStatusTone,
} from "@/features/profile/children-info-card";
import type { StudentRow } from "@/lib/types/database";
import { StudentSwitcher } from "@/features/students/student-switcher";
import { eventKindLabelKey } from "@/features/calendar/event-kind";
import {
  Wallet,
  CalendarClock,
  MessageSquare,
  ChevronRight,
  CalendarDays,
  Receipt,
  AlertTriangle,
  GraduationCap,
  PiggyBank,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatFullName,
  formatParentName,
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

  const activeKid =
    kids.find((k) => k.id === activeStudentId) ?? kids[0] ?? null;
  const parentId = parent?.id ?? null;

  useNotificationsRealtime();
  useFinancialRealtime(parentId);

  const installments = useInstallments(parentId, { limit: 50 });
  const payments = usePayments(parentId, { limit: 5 });
  const events = useUpcomingEvents({ limit: 5 });
  const announcements = useNotifications(user?.id ?? null, { limit: 5 });
  const ledgerEntries = useLedgerEntries(parentId);

  const summary = useMemo(() => {
    if (!ledgerEntries.data || !parentId) return null;
    return portalFinancialSummary(ledgerEntries.data, parentId);
  }, [ledgerEntries.data, parentId]);

  const nextInstallment = useMemo(() => {
    if (!installments.data) return null;
    const unpaid = installments.data
      .filter((i) => i.status !== "paid")
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
      );
    return unpaid[0] ?? null;
  }, [installments.data]);

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12
      ? "dashboard.greeting.morning"
      : hour < 18
        ? "dashboard.greeting.afternoon"
        : "dashboard.greeting.evening";

  const handleRefresh = async () => {
    await Promise.all([
      installments.refetch(),
      payments.refetch(),
      events.refetch(),
      announcements.refetch(),
      ledgerEntries.refetch(),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:py-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary uppercase tracking-wider">
              {t(greetingKey)}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {parent ? formatParentName(parent) : t("app.name")}
            </h1>
          </div>
          {parent?.is_financially_restricted && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 max-w-md shadow-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-bold text-warning">
                  {t("finance.restrictions.title")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("finance.restrictions.body")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Financial KPIs - Large Grid */}
        {ledgerEntries.isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        ) : ledgerEntries.isError ? (
          <ErrorState
            title={t("common.error.title")}
            description={t("common.error.network")}
            onRetry={() => ledgerEntries.refetch()}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label={t("kpi.balanceDue")}
              value={formatCurrency(summary?.outstanding ?? 0)}
              tone={(summary?.outstanding ?? 0) > 0 ? "danger" : "success"}
              icon={<Wallet className="h-6 w-6" />}
              hint={
                (summary?.outstanding ?? 0) > 0
                  ? t("finance.balance.outstandingHint")
                  : t("finance.balance.settled")
              }
              onClick={() => setActiveView("finance")}
            />
            <KpiCard
              label={t("finance.balance.overdue")}
              value={formatCurrency(summary?.overdue ?? 0)}
              tone={(summary?.overdue ?? 0) > 0 ? "danger" : "success"}
              icon={<AlertTriangle className="h-6 w-6" />}
              hint={
                (summary?.overdue ?? 0) > 0
                  ? t("finance.balance.overdueHint")
                  : t("finance.balance.noOverdue")
              }
              onClick={() => setActiveView("finance")}
            />
            <KpiCard
              label={t("kpi.nextInstallment")}
              value={
                nextInstallment
                  ? formatCurrency(installmentRemainingAmount(nextInstallment))
                  : "—"
              }
              tone={
                nextInstallment
                  ? daysUntil(nextInstallment.due_date) < 0
                    ? "danger"
                    : "info"
                  : "success"
              }
              icon={<CalendarClock className="h-6 w-6" />}
              hint={
                nextInstallment
                  ? formatDate(nextInstallment.due_date)
                  : t("finance.empty.noInstallments")
              }
              onClick={() => setActiveView("finance")}
            />
            <KpiCard
              label={t("finance.balance.credit")}
              value={formatCurrency(Math.abs(summary?.unallocatedCredit ?? 0))}
              tone={(summary?.unallocatedCredit ?? 0) < 0 ? "info" : "default"}
              icon={<PiggyBank className="h-6 w-6" />}
              hint={
                (summary?.unallocatedCredit ?? 0) < 0
                  ? t("finance.balance.creditHint")
                  : t("finance.balance.noCredit")
              }
              onClick={() => setActiveView("finance")}
            />
          </div>
        )}

        {/* 3-Column Desktop Layout */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          {/* Column 1: Children & Activity */}
          <div className="space-y-8 xl:col-span-1">
            <section className="space-y-4">
              <SectionHeader title={t("dashboard.section.children")} />
              {kids.length > 1 ? (
                <div className="grid gap-3">
                  {kids.map((kid) => (
                    <SingleChildCard key={kid.id} kid={kid} />
                  ))}
                </div>
              ) : activeKid ? (
                <SingleChildCard kid={activeKid} />
              ) : null}
            </section>

            <section className="space-y-4">
              <SectionHeader
                title={t("dashboard.section.recent")}
                action={
                  <button
                    onClick={() => setActiveView("finance")}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t("dashboard.viewAll")}
                  </button>
                }
              />
              {payments.isLoading ? (
                <ListSkeleton count={3} />
              ) : payments.data && payments.data.length > 0 ? (
                <div className="space-y-3">
                  {payments.data.map((p) => (
                    <CardListItem
                      key={p.id}
                      leading={
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-success">
                          <Receipt className="h-5 w-5" />
                        </div>
                      }
                      title={
                        <span className="font-mono text-base font-bold">
                          {formatCurrency(p.amount)}
                        </span>
                      }
                      subtitle={`${t(`finance.payment.method.${p.method}`)} • ${formatDate(p.collected_at)}`}
                      trailing={
                        <StatusPill tone="success">
                          {t("finance.status.paid")}
                        </StatusPill>
                      }
                      onClick={() => setActiveView("finance")}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t("finance.empty.noPayments")}
                  description={t("finance.empty.noPaymentsBody")}
                  icon={<Receipt className="h-8 w-8" />}
                />
              )}
            </section>
          </div>

          {/* Column 2 & 3: Events and Announcements */}
          <div className="space-y-8 xl:col-span-2">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <section className="space-y-4">
                <SectionHeader
                  title={t("dashboard.section.upcoming")}
                  action={
                    <button
                      onClick={() => setActiveView("calendar")}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t("dashboard.viewAll")}
                    </button>
                  }
                />
                {events.isLoading ? (
                  <ListSkeleton count={4} />
                ) : events.data && events.data.length > 0 ? (
                  <div className="space-y-3">
                    {events.data.map((ev) => (
                      <CardListItem
                        key={ev.id}
                        className="py-4 shadow-sm"
                        leading={
                          <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <CalendarDays className="h-5 w-5" />
                          </div>
                        }
                        title={
                          <span className="text-base font-semibold">
                            {ev.title}
                          </span>
                        }
                        subtitle={
                          <span className="text-sm mt-1 block">
                            {formatDate(ev.start_at, { withTime: !ev.all_day })}
                            {ev.location ? ` • ${ev.location}` : ""}
                          </span>
                        }
                        trailing={
                          <StatusPill tone="info" className="text-xs">
                            {t(eventKindLabelKey(ev.kind))}
                          </StatusPill>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={t("dashboard.empty.noUpcoming")}
                    description={t("dashboard.empty.noUpcomingBody")}
                    icon={<CalendarDays className="h-8 w-8" />}
                  />
                )}
              </section>

              <section className="space-y-4">
                <SectionHeader
                  title={t("dashboard.section.announcements")}
                  action={
                    <button
                      onClick={() => setActiveView("notifications")}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t("dashboard.viewAll")}
                    </button>
                  }
                />
                {announcements.isLoading ? (
                  <ListSkeleton count={4} />
                ) : announcements.data && announcements.data.length > 0 ? (
                  <div className="space-y-3">
                    {announcements.data.slice(0, 5).map((n) => (
                      <CardListItem
                        key={n.id}
                        className="py-4 shadow-sm"
                        leading={
                          <div
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-xl",
                              n.priority === "urgent"
                                ? "bg-destructive/15 text-destructive"
                                : n.priority === "high"
                                  ? "bg-warning/15 text-warning"
                                  : "bg-info/15 text-info",
                            )}
                          >
                            {n.priority === "urgent" ? (
                              <AlertTriangle className="h-5 w-5" />
                            ) : (
                              <MessageSquare className="h-5 w-5" />
                            )}
                          </div>
                        }
                        title={
                          <span className="text-base font-semibold">
                            {n.title}
                          </span>
                        }
                        subtitle={
                          <span className="text-sm mt-1 line-clamp-2">
                            {n.body ?? formatRelative(n.triggered_at)}
                          </span>
                        }
                        trailing={
                          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap ml-2">
                            {formatRelative(n.triggered_at)}
                          </span>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={t("dashboard.empty.noAnnouncements")}
                    description={t("dashboard.empty.noAnnouncementsBody")}
                    icon={<MessageSquare className="h-8 w-8" />}
                  />
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}

function SingleChildCard({ kid }: { kid: StudentRow }) {
  const { t } = useT();
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const levels = useAcademicLevels();
  const klass = useClass(kid.class_id);
  const levelClass = childLevelClassLine(levels.data, klass.data, kid);

  return (
    <Card
      className="cursor-pointer border-border/60 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group"
      onClick={() => {
        setActiveStudentId(kid.id);
        setActiveView("profile");
      }}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-lg text-foreground">
            {formatFullName(kid)}
          </p>
          <p className="truncate text-xs font-mono text-muted-foreground mt-0.5">
            {kid.student_code}
          </p>
          {levelClass && (
            <p className="mt-1.5 truncate text-sm font-medium text-primary/90">
              {levelClass}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
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
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </CardContent>
    </Card>
  );
}
