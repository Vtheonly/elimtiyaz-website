"use client";

/**
 * TopAppBar — mobile-first sticky header.
 *
 * Shows:
 *   - Page title (driven by current view)
 *   - Notifications bell with unread badge
 *   - Profile avatar (tap to open profile)
 *
 * On desktop, the rail handles navigation so the top bar is simplified.
 */

import { Bell, GraduationCap } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import { useT } from "@/lib/i18n/use-t";
import { useAuth } from "@/app/providers/auth-provider";
import { useUnreadNotificationCount } from "@/lib/hooks/portal-queries";
import { cn } from "@/lib/utils";
import { formatInitials } from "@/lib/format";

/**
 * Split a display name like "John Doe" or "John Middle Doe" into the first
 * word and the last word, so we can render proper two-letter initials.
 */
function splitInitials(displayName?: string | null): { first: string; last: string } {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts[parts.length - 1] };
}

const titleByView: Record<string, string> = {
  home: "nav.home",
  academic: "nav.academic",
  finance: "nav.finance",
  attendance: "nav.attendance",
  homework: "nav.homework",
  calendar: "nav.calendar",
  messages: "nav.messages",
  notifications: "nav.notifications",
  profile: "nav.profile",
};

export function TopAppBar() {
  const { t } = useT();
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const { user } = useAuth();
  // T-052 (NOTIF-103): the TRUE unread count (COUNT-only query, no 50-cap).
  const { data: unreadCountData } = useUnreadNotificationCount(user?.id ?? null);
  const unreadCount = unreadCountData ?? 0;

  return (
    <header className="glass-bar safe-pt sticky top-0 z-30 border-b border-border/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        {/* Mobile brand mark (desktop uses the rail) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="font-mono text-sm font-bold">El-Imtiyaz</span>
        </div>

        {/* Active page title (desktop) */}
        <h1 className="hidden text-base font-semibold lg:block">
          {t(titleByView[activeView] ?? "nav.home")}
        </h1>

        <div className="ml-auto flex items-center gap-1">
          {/* Notifications */}
          <button
            type="button"
            onClick={() => setActiveView("notifications")}
            aria-label={t("nav.notifications")}
            className={cn(
              "relative flex touch-target items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
              activeView === "notifications" && "bg-primary/10 text-primary"
            )}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Profile avatar */}
          <button
            type="button"
            onClick={() => setActiveView("profile")}
            aria-label={t("nav.profile")}
            className={cn(
              "flex touch-target items-center justify-center rounded-full p-1 transition-colors hover:bg-muted/50",
              activeView === "profile" && "ring-2 ring-primary/50"
            )}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {(() => {
                  const { first, last } = splitInitials(user?.display_name);
                  return formatInitials(first, last);
                })()}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
