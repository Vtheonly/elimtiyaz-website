"use client";

/**
 * BottomNav — mobile-first primary navigation.
 *
 * Per design system (Entire_Project_Plan.txt → "03. UI and UX Design"):
 *   - 5 primary destinations along the bottom (mobile) / sidebar (desktop)
 *   - Touch targets ≥ 44px
 *   - Color-coded active state using Primary Blue (#349BD4)
 *
 * The portal surfaces these tabs for parents/students:
 *   1. Home / Dashboard
 *   2. Academic (grades, attendance, homework)
 *   3. Payments (installments, history, receipts)
 *   4. Messages (staff communications)
 *   5. Profile (account, language, sign out)
 *
 * Notifications is reachable via the top app bar bell icon, not the bottom
 * nav, to keep the bar at 5 items (ergonomic maximum).
 */

import { Home, GraduationCap, Wallet, MessageSquare, User, CalendarDays } from "lucide-react";
import { useAppStore, type AppView } from "@/lib/store/app-store";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/providers/auth-provider";
import { useUnreadChatCount } from "@/lib/hooks/portal-queries";

interface NavItem {
  view: AppView;
  icon: typeof Home;
  labelKey: string;
}

const mobileItems: NavItem[] = [
  { view: "home", icon: Home, labelKey: "nav.home" },
  { view: "academic", icon: GraduationCap, labelKey: "nav.academic" },
  { view: "finance", icon: Wallet, labelKey: "nav.finance" },
  { view: "messages", icon: MessageSquare, labelKey: "nav.messages" },
  { view: "profile", icon: User, labelKey: "nav.profile" },
];

const desktopItems: NavItem[] = [
  { view: "home", icon: Home, labelKey: "nav.home" },
  { view: "academic", icon: GraduationCap, labelKey: "nav.academic" },
  { view: "attendance", icon: User, labelKey: "nav.attendance" },
  { view: "homework", icon: MessageSquare, labelKey: "nav.homework" },
  { view: "calendar", icon: CalendarDays, labelKey: "nav.calendar" },
  { view: "finance", icon: Wallet, labelKey: "nav.finance" },
  { view: "messages", icon: MessageSquare, labelKey: "nav.messages" },
  { view: "profile", icon: User, labelKey: "nav.profile" },
];

export function BottomNav() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const { t } = useT();
  const { user } = useAuth();
  // T-052 (NOTIF-103): the dead unread-notifications query (fetched 1 row,
  // computed a boolean that no JSX ever rendered) is REMOVED — the bell
  // lives in the top app bar. Messages badge uses the chat unread count.
  const { data: unreadChatCount } = useUnreadChatCount(user?.id ?? null);
  const unreadChat = unreadChatCount ?? 0;

  return (
    <nav
      aria-label="Primary"
      className="glass-bar safe-pb fixed inset-x-0 bottom-0 z-40 border-t border-border/60 lg:hidden"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          const showBadge = item.view === "messages" && unreadChat > 0;
          return (
            <li key={item.view}>
              <button
                type="button"
                onClick={() => setActiveView(item.view)}
                aria-current={isActive ? "page" : undefined}
                aria-label={t(item.labelKey)}
                className={cn(
                  "relative flex w-full touch-target flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="truncate text-[10px] leading-none">{t(item.labelKey)}</span>
                {showBadge && (
                  <span
                    aria-hidden
                    className="absolute right-[calc(50%-22px)] top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background"
                  />
                )}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop side rail                                                          */
/* -------------------------------------------------------------------------- */

export function DesktopRail() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const { t } = useT();
  const { user } = useAuth();
  // T-052 (NOTIF-103): the dead unread-notifications query removed (same
  // cleanup as BottomNav — the bell lives in the top app bar).
  const { data: unreadChatCount } = useUnreadChatCount(user?.id ?? null);
  const unreadChat = unreadChatCount ?? 0;

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card/50 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold leading-none">El-Imtiyaz</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{t("app.tagline")}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
        {desktopItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          const showBadge = item.view === "messages" && unreadChat > 0;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => setActiveView(item.view)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex w-full touch-target items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{t(item.labelKey)}</span>
              {showBadge && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                  {unreadChat}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3 text-[10px] text-muted-foreground">
        <p className="font-mono">v1.0.0 — portal</p>
      </div>
    </aside>
  );
}
