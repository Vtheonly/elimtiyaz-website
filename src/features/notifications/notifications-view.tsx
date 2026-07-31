"use client";

/**
 * NotificationsView — parent-facing notification center.
 *
 * Reads from the `notifications` table filtered by target_user_id.
 * Marks notifications as read when opened.
 *
 * FCM push notifications (background) are handled by the service worker.
 * This view handles in-app notifications only.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useNotifications } from "@/lib/hooks/portal-queries";
import {
  EmptyState,
  ListSkeleton,
  ErrorState,
  CardListItem,
} from "@/features/shared/state-views";
import {
  AlertTriangle,
  Bell,
  Info,
  CheckCircle2,
  AlertCircle,
  CheckCheck,
} from "lucide-react";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { NotificationRow } from "@/lib/types/database";

const kindIcon: Record<string, typeof Bell> = {
  alert: AlertTriangle,
  info: Info,
  warning: AlertCircle,
  success: CheckCircle2,
  error: AlertCircle,
  system: Bell,
};

export function NotificationsView() {
  const { t } = useT();
  const { user } = useAuth();
  const notifications = useNotifications(user?.id ?? null, { limit: 100 });

  const markAllRead = async () => {
    if (!supabase || !user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("target_user_id", user.id)
      .eq("is_read", false);
    if (error) {
      toast.error(error.message);
      return;
    }
    notifications.refetch();
    toast.success("Marqué comme lu");
  };

  const markRead = async (n: NotificationRow) => {
    if (!supabase || n.is_read) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", n.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    notifications.refetch();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("notifications.title")}</h1>
        {notifications.data && notifications.data.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {notifications.isLoading ? (
        <ListSkeleton count={6} />
      ) : notifications.isError ? (
        <ErrorState title={t("common.error.title")} onRetry={() => notifications.refetch()} />
      ) : notifications.data && notifications.data.length > 0 ? (
        <div className="space-y-2">
          {notifications.data.map((n) => {
            const Icon = kindIcon[n.kind] ?? Bell;
            const tone =
              n.priority === "urgent"
                ? "text-destructive bg-destructive/10"
                : n.priority === "high"
                  ? "text-warning bg-warning/10"
                  : n.kind === "success"
                    ? "text-success bg-success/10"
                    : "text-info bg-info/10";
            return (
              <CardListItem
                key={n.id}
                onClick={() => markRead(n)}
                className={n.is_read ? "opacity-60" : ""}
                leading={
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                }
                title={
                  <span className={n.is_read ? "font-normal" : "font-semibold"}>
                    {n.title}
                  </span>
                }
                subtitle={n.body ?? undefined}
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(n.triggered_at)}
                    </span>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary" aria-label="Non lu" />
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState title={t("notifications.empty")} icon={<Bell className="h-6 w-6" />} />
      )}
    </div>
  );
}
