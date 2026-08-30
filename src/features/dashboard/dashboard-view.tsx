"use client";

/**
 * DashboardView — the parent's home screen.
 *
 * RESTRUCTURED (session 8, 2026-08-30) around what the backend actually
 * holds. Live-data evidence that drove the change:
 *
 *   - The parent greeting used first_name + last_name, but the Excel
 *     import left first_name EMPTY on all 258 production rows → the
 *     greeting rendered a leading space. Now uses display_name first
 *     (formatParentName).
 *   - The old KPI grid devoted half its slots to attendance rate and
 *     average grade — but attendance_records/assessments are EMPTY in
 *     production, so parents saw two dead "—" tiles forever. The dashboard
 *     now leads with the four canonical financial KPIs (ledger replay,
 *     INV-1): outstanding, overdue, next installment, credit. Academic
 *     KPIs live in the Academic hub where the data lands.
 *
 * Sections (mobile-first vertical feed):
 *   1. Greeting (display_name) + financial restriction banner
 *   2. KPI grid — canonical financial health
 *   3. Children list (quick links to per-child views)
 *   4. Upcoming events (calendar_events)
 *   5. Recent announcements (notifications)
 *   6. Recent payments (payments)
 *
 * All data comes from Supabase via RLS-protected queries. If a query returns
 * empty, we render an honest EmptyState that explains WHY, never fake data.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import {
  useInstallments,
  usePayments,
  useNotifications,
  useUpcomingEvents,
  useLedgerEntries,
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
import { StudentSwitcher } from "@/features/students/student-switcher";
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

  const activeKid = kids.find((k) => k.id === activeStudentId) ?? kids[0] ?? null;
  // Hoisted so the React Compiler can preserve the memoizations below.
  const parentId = parent?.id ?? null;

  // Realtime: refresh notifications + financial data when the backend changes.
  useNotificationsRealtime();
  useFinancialRealtime(parentId);

  // KPI data
  const installments = useInstallments(parent?.id ?? null, { limit: 50 });
  const payments = usePayments(parent?.id ?? null, { limit: 5 });
  const events = useUpcomingEvents({ limit: 5 });
  const announcements = useNotifications(user?.id ?? null, { limit: 5 });
  // Canonical balance source (INV-1) — ledger replay, identical to the
  // desktop debt dashboard / backend compute_parent_summary RPC.
  const ledgerEntries = useLedgerEntries(parentId) // T-035/WEAK-022: full ledger replay (paged) — a hard cap would corrupt the balance;

  // Canonical financial summary (ledger replay — never installment sums).
  const summary = useMemo(() => {
    if (!ledgerEntries.data || !parentId) return null;
    return portalFinancialSummary(ledgerEntries.data, parentId);
  }, [ledgerEntries.data, parentId]);

  // Next upcoming installment (earliest unpaid)
  const nextInstallment = useMemo(() => {
    if (!installments.data) return null;
    const unpaid = installments.data
      .filter((i) => i.status !== "paid")
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return unpaid[0] ?? null;
  }, [installments.data]);

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "dashboard.greeting.morning" : hour < 18 ? "dashboard.greeting.afternoon" : "dashboard.greeting.evening";

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
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
        {/* Greeting — display_name first (first_name is empty on all
            production rows; the old join rendered a leading space). */}
        <div>
          <p className="text-sm text-muted-foreground">{t(greetingKey)}</p>
          <h1 className="mt-0.5 text-xl font-semibold">
            {parent ? formatParentName(parent) : t("app.name")}
          </h1>
        </div>

        {/* Financial restriction banner */}
        {parent?.is_financially_restricted && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-warning">{t("finance.restrictions.title")}</p>
              <p className="mt-1 text-muted-foreground">{t("finance.restrictions.body")}</p>
            </div>
          </div>
        )}

        {/* KPI grid — canonical financial health (ledger replay, INV-1) */}
        {ledgerEntries.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label={t("kpi.balanceDue")}
              value={formatCurrency(summary?.outstanding ?? 0)}
              tone={(summary?.outstanding ?? 0) > 0 ? "danger" : "success"}
              icon={<Wallet className="h-5 w-5" />}
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
              icon={<AlertTriangle className="h-5 w-5" />}
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
              icon={<CalendarClock className="h-5 w-5" />}
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
              icon={<PiggyBank className="h-5 w-5" />}
              hint={
                (summary?.unallocatedCredit ?? 0) < 0
                  ? t("finance.balance.creditHint")
                  : t("finance.balance.noCredit")
              }
              onClick={() => setActiveView("finance")}
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
                      <StatusPill tone={ev.kind === "custom" ? "info" : "info"}>
                        {ev.kind}
                      </StatusPill>
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={t("dashboard.empty.noUpcoming")}
                description={t("dashboard.empty.noUpcomingBody")}
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
                description={t("dashboard.empty.noAnnouncementsBody")}
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
              description={t("finance.empty.noPaymentsBody")}
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
