"use client";

/**
 * LoginScreen — the only public surface of the portal.
 *
 * Google OAuth via Supabase is the ONLY authentication path. The mock-admin
 * login ("Admin" button + localStorage session) was removed by task T-009
 * (SEC-007): it hydrated a staff-grade session from a planted localStorage
 * key with no authentication at all. Do not reintroduce mock auth here.
 *
 * BRAND (T-530 / UI-344): the hero block carries the desktop's particle
 * animation — the ParticleCanvas field whose particles form the ACTUAL
 * brand pictogram (public/intro-logo.png, the byte-identical desktop
 * asset). The canvas is decorative (aria-hidden) and never intercepts the
 * form. The former GraduationCap icon box was a generic placeholder, not a
 * brand mark — it is retired by this change (documented, deliberate).
 *
 * T-531 (UI-345) — the widescreen + polish pass: at lg+ the screen mirrors
 * the DESKTOP's own login split (brand side-panel with the growing particle
 * field + form panel — see elimtiyaz-desktop login-screen.tsx's
 * `lg:grid-cols-[1fr_400px]`), the container widens with the viewport, and
 * a static brand-mark layer (the inverted image screened over the panel —
 * the off-white excitation tone) renders instantly under the canvas and
 * serves as the prefers-reduced-motion presentation. Below lg the mobile
 * stack is byte-identical to the T-530 layout. Presentation only: the auth
 * logic, the error surfaces, and every i18n contract are untouched.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { ParticleCanvas } from "@/components/particle-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

export function LoginScreen() {
  const { signInWithGoogle, configured, error } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      // OAuth redirect takes time; reset only if we didn't redirect.
      setTimeout(() => setBusy(false), 3000);
    }
  };

  return (
    /* T-531 (UI-345) — the widescreen split: the DESKTOP's own login pattern
     * faithfully mirrored at lg+ — a FULL-BLEED, FULL-HEIGHT brand side-panel
     * (its `lg:grid-cols-[1fr_400px]` split with the bordered bg-surface
     * panel, the h-[50vh] canvas, and the justify-between header/field/
     * footer rhythm) beside the form column. The brand panel OWNS 42% of
     * the display edge-to-edge and the field grows with the viewport height
     * (44vh, up to ~640px of pictogram on a 1440-tall screen) — large
     * displays get a native two-panel composition, not a narrow centered
     * column floating in the void. Below lg the layout collapses to the
     * exact T-530 mobile stack (hero → card → help). */
    <main className="brand-gradient relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 lg:grid lg:grid-cols-[minmax(480px,42%)_1fr] lg:p-0">
      <div
        aria-hidden
        className="brand-grid-overlay pointer-events-none absolute inset-0"
      />
      {/* Brand hero — the desktop's particle animation forming the actual
          brand pictogram (interactive: particles repel the pointer). The
          panel framing (rounded + ring) mirrors the login card's own design
          language, and the 240px height honors the engine wrapper's minimum
          canvas dimension (verbatim-port behavior). At lg+ the hero BECOMES
          the desktop's side-panel: full-height, header (wordmark) → field
          → version footer, spread with justify-between. */}
      <section className="animate-fade-up mb-8 flex flex-col items-center gap-4 text-center lg:mb-0 lg:h-full lg:justify-between lg:border-r lg:border-border/50 lg:bg-card/40 lg:p-10 lg:pb-6 xl:p-16 xl:pb-8 2xl:p-20 2xl:pb-10">
        <div className="order-2 lg:order-1">
          <h1 className="brand-text-gradient font-mono text-2xl font-bold tracking-tight sm:text-3xl xl:text-4xl 2xl:text-5xl">
            {t("app.name")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground lg:text-base">
            {t("app.tagline")}
          </p>
        </div>
        <div
          className="order-1 relative h-[240px] w-64 overflow-hidden rounded-2xl bg-card/30 ring-1 ring-border/60 sm:w-80 lg:order-2 lg:h-[44vh] lg:w-full lg:max-w-[560px] lg:rounded-none lg:bg-transparent lg:ring-0 2xl:max-w-[640px]"
          aria-hidden
        >
          {/* the static brand-mark layer (instant paint + the
              reduced-motion presentation — see the splash's identical
              layer; same byte-identical asset, CSS blend only, §15.107) */}
          <img
            src="/intro-logo.png"
            alt=""
            className="absolute inset-0 h-full w-full object-contain opacity-90 invert mix-blend-screen"
          />
          {/* density 2 ≈ 1,600 particles from the brand asset — the desktop
              login's density-1 parity is intentionally relaxed for the
              mobile-first portal (performance budget, T-530 contract). */}
          <ParticleCanvas mode="logo" density={2} fillRatio={0.85} />
        </div>
        {/* the version footer — the desktop side-panel's bottom line,
          desktop-only (existing i18n key, no new strings) */}
        <p className="order-3 hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground lg:block">
          {t("app.version")}
        </p>
      </section>

      {/* Form column — vertically centered in the open 58% (the desktop's
          form side is likewise a plain centered column). */}
      <section className="animate-fade-up relative flex w-full flex-col items-center justify-center px-5 [animation-delay:120ms] lg:px-16">
        <div className="flex w-full max-w-md flex-col items-center">
          <Card className="card-glow w-full max-w-md border-border/60 bg-card/95 backdrop-blur">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-5 text-center">
                <h2 className="text-lg font-semibold text-foreground">
                  {t("auth.signin.title")}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("auth.signin.subtitle")}
                </p>
              </div>

              {!configured && (
                <div className="mb-4 flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">
                      {t("auth.signin.configError.title")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("auth.signin.configError.body")}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-destructive-foreground">
                    {/* AUTH-200: the provider_disabled code is set by the
                        auth-provider when the Supabase Google provider is
                        disabled server-side (the only remaining portal-login
                        blocker — owner runbook in the hub repo). */}
                    {/* AUTH-401 / T-521: oauth_exchange_failed / oauth_failed are
                        set when Supabase redirects an OAuth FAILURE back to the
                        portal (e.g. Google rejecting the sign-in exchange) —
                        previously these redirects were silently swallowed. */}
                    {error === "provider_disabled"
                      ? t("auth.signin.providerDisabled")
                      : error === "oauth_exchange_failed"
                        ? t("auth.signin.oauthExchangeFailed")
                        : error === "oauth_failed"
                          ? t("auth.signin.oauthFailed")
                          : error}
                  </p>
                </div>
              )}

              <Button
                onClick={handleSignIn}
                disabled={!configured || busy}
                className="btn-glow w-full touch-target"
                size="lg"
                variant="outline"
              >
                <GoogleIcon className="mr-2 h-5 w-5" />
                {t("auth.signin.google")}
              </Button>

              <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("auth.signin.secure")}
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
            {t("auth.signin.help")}
          </p>
        </div>
      </section>
    </main>
  );
}

/* Google multi-color "G" logo */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
