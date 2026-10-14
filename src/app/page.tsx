"use client";

/**
 * Home — the single user-visible route for the El-Imtiyaz Client Web Portal.
 *
 * Auth state machine (per user requirements):
 *   loading         → splash screen (T-531: the branded particle mark + the
 *                     indeterminate sweep bar — was the GraduationCap
 *                     placeholder + a bare animate-pulse half-bar)
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
import { ParticleCanvas } from "@/components/particle-canvas";
import { useT } from "@/lib/i18n/use-t";

export default function Home() {
  const { state } = useAuth();
  const { t } = useT();

  if (state === "loading") {
    /* T-531 (UI-345) — the branded loading state: the particle brand mark
     * (the same decorative field as the login) + an indeterminate progress
     * bar with real motion (the sweep) replacing the bare animate-pulse
     * half-bar. The static logo layer underneath the canvas serves double
     * duty: it renders instantly while the engine warms up (the canvas
     * cross-fades over it as the motion-blur fill accumulates) AND it is
     * the reduced-motion presentation — the inverted image screened over
     * the dark panel reads as the off-white pictogram (the same near-white
     * the engine uses for pointer excitation), so no user ever sees an
     * empty box. The asset is the SAME byte-identical file (§15.107) — no
     * recolour, the CSS blend only. */
    return (
      <main className="brand-gradient relative flex min-h-[100dvh] flex-col items-center justify-center px-6">
        <div
          aria-hidden
          className="brand-grid-overlay pointer-events-none absolute inset-0"
        />
        <div className="animate-fade-up relative flex w-full flex-col items-center">
          <div
            className="relative h-[240px] w-64 overflow-hidden rounded-2xl ring-1 ring-border/60 sm:w-80"
            aria-hidden
          >
            {/* the static brand-mark layer (instant + reduced-motion fallback) */}
            <img
              src="/intro-logo.png"
              alt=""
              className="absolute inset-0 h-full w-full object-contain opacity-90 invert mix-blend-screen"
            />
            {/* the living particle field (paints over the static layer) */}
            <ParticleCanvas mode="logo" density={2} fillRatio={0.85} />
          </div>
          <p className="mt-6 font-mono text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            {t("app.portal")}
          </p>
          {/* the indeterminate bar — aria-busy (no aria-valuenow: the value
              is unknown by definition of the auth bootstrap) */}
          <div
            role="progressbar"
            aria-busy="true"
            aria-label={t("app.loading")}
            className="progress-track mt-5 h-1.5 w-52 overflow-hidden rounded-full"
          >
            <div className="progress-bar-sweep h-full w-2/5 rounded-full" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground/80">
            {t("app.loading")}
          </p>
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
