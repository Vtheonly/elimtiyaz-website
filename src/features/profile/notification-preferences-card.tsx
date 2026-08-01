"use client";

/**
 * NotificationPreferencesCard — per-category opt-in/out.
 *
 * Reads from the `notification_preferences` table (migration 0028). Missing
 * rows are treated as "both push and in-app enabled" (default opt-in).
 *
 * The user can toggle push and in-app independently for each of the 9
 * notification categories documented in the project plan:
 *   payment, absence, message, announcement, grade, homework, calendar,
 *   account, system.
 *
 * The Edge Function `send-push-notification` should be configured to consult
 * this table before sending a push (it currently fans out to every active
 * device token — the per-category filter is a future enhancement, but the
 * preferences UI is shipped now so parents can opt out proactively).
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Loader2, Check } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { useAuth } from "@/app/providers/auth-provider";
import {
  useNotificationPreferences,
  NOTIFICATION_CATEGORIES,
} from "@/lib/hooks/portal-queries";
import { supabase } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NotificationCategory, NotificationPreferenceRow } from "@/lib/types/database";

interface PendingChange {
  push_enabled: boolean;
  in_app_enabled: boolean;
}

export function NotificationPreferencesCard() {
  const { t } = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const preferences = useNotificationPreferences(user?.id ?? null);

  // Local pending-changes map: keyed by category, contains the un-saved
  // toggle state. Empty = no pending changes for that category.
  const [pending, setPending] = useState<Map<NotificationCategory, PendingChange>>(new Map());
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null);

  // Reset pending when the server data changes (e.g. after a refetch).
  // This is a deliberate reset-on-prop-change pattern — the lint rule
  // complains but the alternative (key-prop remounting) would lose the
  // pending toggle state during rapid edits.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(new Map());
  }, [preferences.data]);

  /**
   * Read the effective state for a category: use the pending change if any,
   * otherwise fall back to the server row, otherwise default to both enabled.
   */
  const getState = (cat: NotificationCategory): PendingChange => {
    const p = pending.get(cat);
    if (p) return p;
    const row = preferences.data?.get(cat);
    if (row) {
      return { push_enabled: row.push_enabled, in_app_enabled: row.in_app_enabled };
    }
    return { push_enabled: true, in_app_enabled: true };
  };

  const setState = (cat: NotificationCategory, partial: Partial<PendingChange>) => {
    setPending((prev) => {
      const next = new Map(prev);
      const current = getState(cat);
      next.set(cat, { ...current, ...partial });
      return next;
    });
  };

  const saveCategory = async (cat: NotificationCategory) => {
    if (!user || !supabase) return;
    const change = pending.get(cat);
    if (!change) return;
    setSavingCategory(cat);
    try {
      // Upsert: if the row doesn't exist yet, insert; otherwise update.
      const existing = preferences.data?.get(cat);
      if (existing) {
        const { error } = await supabase
          .from("notification_preferences")
          .update({
            push_enabled: change.push_enabled,
            in_app_enabled: change.in_app_enabled,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({
            user_profile_id: user.id,
            category: cat,
            push_enabled: change.push_enabled,
            in_app_enabled: change.in_app_enabled,
          });
        if (error) throw error;
      }
      // Clear the pending change and refetch.
      setPending((prev) => {
        const next = new Map(prev);
        next.delete(cat);
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["notification-preferences", user.id] });
      toast.success(t("prefs.notifications.saved"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSavingCategory(null);
    }
  };

  const hasPendingFor = (cat: NotificationCategory) => pending.has(cat);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Bell className="h-4 w-4" />
          {t("prefs.notifications.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("prefs.notifications.body")}</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {preferences.isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : preferences.isError ? (
          <p className="py-3 text-sm text-destructive">{t("common.error.title")}</p>
        ) : (
          <>
            {/* Column headers */}
            <div className="flex items-center justify-between pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>{t("prefs.notifications.body").split(":")[0]}</span>
              <div className="flex gap-6">
                <span className="w-10 text-center">{t("prefs.notifications.push")}</span>
                <span className="w-10 text-center">{t("prefs.notifications.inApp")}</span>
              </div>
            </div>
            <Separator />
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const state = getState(cat);
              const isPending = hasPendingFor(cat);
              const isSaving = savingCategory === cat;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">{t(`prefs.notifications.category.${cat}`)}</span>
                    <div className="flex items-center gap-6">
                      <div className="flex w-10 justify-center">
                        <Switch
                          checked={state.push_enabled}
                          onCheckedChange={(v) => setState(cat, { push_enabled: v })}
                          aria-label={`${t("prefs.notifications.push")} — ${t(`prefs.notifications.category.${cat}`)}`}
                        />
                      </div>
                      <div className="flex w-10 justify-center">
                        <Switch
                          checked={state.in_app_enabled}
                          onCheckedChange={(v) => setState(cat, { in_app_enabled: v })}
                          aria-label={`${t("prefs.notifications.inApp")} — ${t(`prefs.notifications.category.${cat}`)}`}
                        />
                      </div>
                    </div>
                  </div>
                  {isPending && (
                    <div className="flex justify-end pb-1">
                      <button
                        type="button"
                        onClick={() => saveCategory(cat)}
                        disabled={isSaving}
                        className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        {t("common.save")}
                      </button>
                    </div>
                  )}
                  <Separator />
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
