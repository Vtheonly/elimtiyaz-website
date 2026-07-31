"use client";

/**
 * Home — the single user-visible route for the El-Imtiyaz Client Web Portal.
 *
 * Auth state machine (per user requirements):
 *   loading         → splash screen
 *   unauthenticated → LoginScreen (Google OAuth)
 *   pending         → PendingActivationScreen
 *                    "Your account has not yet been activated.
 *                     Please contact your school administrator."
 *   suspended       → PendingActivationScreen (suspended variant)
 *   rejected        → PendingActivationScreen (rejected variant)
 *   active          → AppShell (full portal)
 *
 * The portal does NOT implement registration, invitations, activation, or
 * role assignment. Those workflows belong to the desktop application.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { LoginScreen } from "@/features/auth/login-screen";
import { PendingActivationScreen } from "@/features/auth/pending-activation-screen";
import { AppShell } from "@/features/shared/app-shell";
import { GraduationCap } from "lucide-react";

export default function Home() {
  const { state } = useAuth();

  if (state === "loading") {
    return (
      <main className="brand-gradient flex min-h-[100dvh] flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <GraduationCap className="h-9 w-9" />
        </div>
        <p className="font-mono text-sm text-muted-foreground">El-Imtiyaz Portal</p>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </main>
    );
  }

  if (state === "unauthenticated") {
    return <LoginScreen />;
  }

  if (state === "pending") {
    return <PendingActivationScreen variant="pending" />;
  }

  if (state === "suspended") {
    return <PendingActivationScreen variant="suspended" />;
  }

  if (state === "rejected") {
    return <PendingActivationScreen variant="rejected" />;
  }

  // state === "active"
  return <AppShell />;
}
