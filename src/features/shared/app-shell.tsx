"use client";

/**
 * AppShell — the authenticated portal layout.
 *
 * Mobile-first:
 *   - Top app bar (sticky, brand + notifications bell + avatar)
 *   - Main content area (single active view)
 *   - Bottom navigation bar (5 destinations, sticky bottom)
 *
 * Desktop (lg+) — T-327 intentional desktop layout (58th session):
 *   - The shell switches to flex-ROW at lg so the DesktopRail sits BESIDE
 *     the content (it previously stacked ABOVE it: the wrapper was
 *     flex-col and the rail's lg:flex only made it visible, not lateral —
 *     the "stretched mobile" bug the owner reported).
 *   - The rail is STICKY + full viewport height (stays visible on scroll).
 *   - Each view owns its container width (max-w-5xl default, the dashboard
 *     and financial views widen deliberately — see T-327).
 *
 * The shell uses a SPA-style view switcher instead of Next.js routes because
 * the portal is fundamentally a single-screen dashboard. This matches the
 * mobile-first UX requirement: tabs switch instantly without page reloads.
 */

import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store/app-store";
import { useHashRoute } from "@/lib/hooks/use-hash-route";
import { useChatUnreadRealtime } from "@/lib/hooks/use-realtime";
import { TopAppBar } from "@/features/shared/top-app-bar";
import { BottomNav, DesktopRail } from "@/features/shared/bottom-nav";
import { OfflineIndicator } from "@/features/shared/offline-indicator";
import { ErrorBoundary } from "@/features/shared/error-boundary";
import { PwaInstallPrompt } from "@/features/shared/pwa-install-prompt";
import { SwUpdateBanner } from "@/features/shared/sw-update-banner";
import { ListSkeleton } from "@/features/shared/state-views";

// Code-split each feature view so the initial bundle only contains the
// dashboard. Other views are lazy-loaded on first navigation.
const DashboardView = dynamic(
  () => import("@/features/dashboard/dashboard-view").then((m) => m.DashboardView),
  { loading: () => <ListSkeleton count={4} /> }
);
const AcademicView = dynamic(
  () => import("@/features/academic/academic-view").then((m) => m.AcademicView),
  { loading: () => <ListSkeleton count={4} /> }
);
const FinancialView = dynamic(
  () => import("@/features/financial/financial-view").then((m) => m.FinancialView),
  { loading: () => <ListSkeleton count={4} /> }
);
const AttendanceView = dynamic(
  () => import("@/features/attendance/attendance-view").then((m) => m.AttendanceView),
  { loading: () => <ListSkeleton count={4} /> }
);
const HomeworkView = dynamic(
  () => import("@/features/homework/homework-view").then((m) => m.HomeworkView),
  { loading: () => <ListSkeleton count={4} /> }
);
const CalendarView = dynamic(
  () => import("@/features/calendar/calendar-view").then((m) => m.CalendarView),
  { loading: () => <ListSkeleton count={4} /> }
);
const MessagesView = dynamic(
  () => import("@/features/messages/messages-view").then((m) => m.MessagesView),
  { loading: () => <ListSkeleton count={4} /> }
);
const NotificationsView = dynamic(
  () => import("@/features/notifications/notifications-view").then((m) => m.NotificationsView),
  { loading: () => <ListSkeleton count={4} /> }
);
const ProfileView = dynamic(
  () => import("@/features/profile/profile-view").then((m) => m.ProfileView),
  { loading: () => <ListSkeleton count={4} /> }
);

export function AppShell() {
  const activeView = useAppStore((s) => s.activeView);
  // Sync active view with the URL hash (#/finance, #/academic, …).
  useHashRoute();
  // REALTIME-103 (T-032): one shell-level subscription invalidates the
  // unread-count query when messages arrive in ANY channel — the badge
  // owners (BottomNav / DesktopRail / TopAppBar) all read that query, and
  // mounting the subscription ONCE here avoids duplicate websocket
  // channels per nav component.
  useChatUnreadRealtime();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background lg:flex-row">
      {/* Desktop rail (left sidebar) — sticky, full height, lateral at lg */}
      <DesktopRail />

      {/* Mobile + desktop content column */}
      <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col">
        <TopAppBar />
        <SwUpdateBanner />
        <OfflineIndicator />

        <main className="flex-1 pb-24 lg:pb-6">
          {/* Each view is wrapped in an ErrorBoundary so a crash in one
              view doesn't take down the whole app. */}
          <ErrorBoundary key={activeView}>
            {activeView === "home" && <DashboardView />}
            {activeView === "academic" && <AcademicView />}
            {activeView === "finance" && <FinancialView />}
            {activeView === "attendance" && <AttendanceView />}
            {activeView === "homework" && <HomeworkView />}
            {activeView === "calendar" && <CalendarView />}
            {activeView === "messages" && <MessagesView />}
            {activeView === "notifications" && <NotificationsView />}
            {activeView === "profile" && <ProfileView />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* PWA install prompt (appears when browser supports it) */}
      <PwaInstallPrompt />
    </div>
  );
}
