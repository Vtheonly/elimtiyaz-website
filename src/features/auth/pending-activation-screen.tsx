"use client";

/**
 * PendingActivationScreen — shown when a user signs in with Google but their
 * account has not yet been activated by the desktop application.
 *
 * Per user requirements:
 *   "If a user's account has not yet been activated, display an appropriate
 *    message such as: 'Your account has not yet been activated. Please contact
 *    your school administrator.'"
 *
 * This screen does NOT attempt to:
 *   - Re-trigger activation
 *   - Bind the user to a parent profile
 *   - Submit any kind of activation code
 *
 * The desktop application remains the authoritative system for account
 * provisioning, activation, role assignment, and tenant management.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  ShieldX,
  UserX,
  LogOut,
  Mail,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

type Variant = "pending" | "suspended" | "rejected";

const config: Record<
  Variant,
  { icon: typeof Clock; tone: string; titleKey: string; bodyKey: string; contactKey?: string }
> = {
  pending: {
    icon: Clock,
    tone: "text-warning bg-warning/10 ring-warning/30",
    titleKey: "activation.pending.title",
    bodyKey: "activation.pending.body",
    contactKey: "activation.pending.contact",
  },
  suspended: {
    icon: ShieldX,
    tone: "text-destructive bg-destructive/10 ring-destructive/30",
    titleKey: "activation.suspended.title",
    bodyKey: "activation.suspended.body",
  },
  rejected: {
    icon: UserX,
    tone: "text-destructive bg-destructive/10 ring-destructive/30",
    titleKey: "activation.rejected.title",
    bodyKey: "activation.rejected.body",
  },
};

interface Props {
  variant?: Variant;
}

export function PendingActivationScreen({ variant = "pending" }: Props) {
  const { signOut, user, refresh } = useAuth();
  const { t } = useT();
  const cfg = config[variant];
  const Icon = cfg.icon;

  return (
    <main className="brand-gradient relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <Card className="w-full max-w-md border-border/60 bg-card/95 backdrop-blur">
        <CardContent className="p-6">
          <div className="mb-5 flex flex-col items-center text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full ring-1 ${cfg.tone}`}
            >
              <Icon className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-foreground">
              {t(cfg.titleKey)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t(cfg.bodyKey)}</p>
            {cfg.contactKey && (
              <p className="mt-3 text-sm font-medium text-foreground">
                {t(cfg.contactKey)}
              </p>
            )}
          </div>

          {user && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {(user.display_name ?? user.email ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.display_name ?? user.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full touch-target" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.refresh")}
            </Button>
            <Button
              variant="ghost"
              className="w-full touch-target text-muted-foreground"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("activation.pending.signout")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        {t("auth.signin.help")}
      </p>
    </main>
  );
}
