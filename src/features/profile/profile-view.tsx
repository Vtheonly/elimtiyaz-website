"use client";

/**
 * ProfileView — account info, preferences, sign out.
 *
 * Per requirements, the portal does NOT handle:
 *   - Account activation (desktop-only)
 *   - Role assignment (desktop-only)
 *   - Password changes (parents use Google OAuth, no password)
 *
 * This view is read-only for account info; user can only change:
 *   - UI language (fr / ar / en)
 *   - Theme (dark / light)
 *   - Sign out
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  User as UserIcon,
  Phone,
  Building2,
  Globe,
  Moon,
  Sun,
  LogOut,
  ShieldCheck,
  Languages,
  Bell,
} from "lucide-react";
import { LOCALES, type Locale } from "@/lib/i18n/dictionary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState, useEffect, useMemo } from "react";
import { isFcmConfigured, onForegroundPush } from "@/lib/fcm";
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from "@/lib/hooks/fcm-registration";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

const statusLabels: Record<string, string> = {
  active: "profile.status.active",
  pending: "profile.status.pending",
  suspended: "profile.status.suspended",
  deleted: "profile.status.suspended",
};

export function ProfileView() {
  const { t } = useT();
  const { user, parent, signOut } = useAuth();
  const { locale, setLocale, theme, setTheme } = useAppStore();
  const [pushEnabled, setPushEnabled] = useState(() =>
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  );

  // Push support is a constant for the lifetime of the page — compute once.
  const pushSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      isFcmConfigured,
    []
  );

  // Subscribe to foreground pushes for toast notifications.
  useEffect(() => {
    if (!pushEnabled) return;
    const unsub = onForegroundPush((payload) => {
      toast(payload.title ?? "El-Imtiyaz", {
        description: payload.body,
      });
    });
    return unsub;
  }, [pushEnabled]);

  const togglePush = async (enabled: boolean) => {
    if (!user) return;
    if (enabled) {
      // Request permission + get FCM token, then register it server-side.
      const ok = await registerDeviceToken(user.id);
      if (ok) {
        setPushEnabled(true);
        toast.success("Notifications activées");
      } else {
        setPushEnabled(false);
        toast.error("Impossible d'activer les notifications");
      }
    } else {
      // Soft-delete the device token so the backend stops sending pushes.
      await unregisterDeviceToken(user.id);
      setPushEnabled(false);
      toast.info("Notifications désactivées");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5">
      <h1 className="text-xl font-semibold">{t("profile.title")}</h1>

      {/* Profile header */}
      <Card className="border-border/60">
        <CardContent className="flex items-center gap-4 p-4">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <UserIcon className="h-8 w-8" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {parent ? `${parent.first_name} ${parent.last_name}` : user?.display_name ?? user?.email}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            {parent && (
              <p className="mt-1 text-xs text-muted-foreground">
                {parent.parent_code}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("profile.account")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow icon={<Mail className="h-4 w-4" />} label={t("profile.email")} value={user?.email} />
          <Separator />
          <InfoRow
            icon={<UserIcon className="h-4 w-4" />}
            label={t("profile.name")}
            value={parent ? `${parent.first_name} ${parent.last_name}` : user?.display_name}
          />
          <Separator />
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label={t("profile.phone")}
            value={parent?.primary_phone ?? user?.phone}
          />
          <Separator />
          <InfoRow
            icon={<ShieldCheck className="h-4 w-4" />}
            label={t("profile.status")}
            value={user ? t(statusLabels[user.status] ?? "profile.status.pending") : "—"}
            tone={user?.status === "active" ? "success" : "warning"}
          />
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Préférences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Languages className="h-4 w-4 text-muted-foreground" />
              {t("profile.language")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  className={cn(
                    "touch-target rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    locale === l
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  {localeLabels[l]}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Theme */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {t("profile.theme")}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  theme === "dark"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/40"
                )}
              >
                {t("profile.theme.dark")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  theme === "light"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/40"
                )}
              >
                {t("profile.theme.light")}
              </button>
            </div>
          </div>

          <Separator />

          {/* Push notifications */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-4 w-4" />
              Notifications push
            </div>
            {pushSupported ? (
              <Switch checked={pushEnabled} onCheckedChange={togglePush} aria-label="Notifications push" />
            ) : (
              <span className="text-xs text-muted-foreground">Non disponible</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Building2 className="h-4 w-4" />
            {t("profile.about")}
          </p>
          <p>{t("profile.about.body")}</p>
        </CardContent>
      </Card>

      {/* Sign out */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full touch-target text-destructive hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            {t("auth.signout")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("auth.signout")}</AlertDialogTitle>
            <AlertDialogDescription>{t("auth.signout.confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={signOut}>{t("auth.signout")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="pb-4 text-center text-xs text-muted-foreground">
        {t("profile.version")} 1.0.0
      </p>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  tone?: "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning"
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}
