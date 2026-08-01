"use client";

/**
 * LoginScreen — the only public surface of the portal.
 *
 * Workflow (per user requirements):
 *   - Single CTA: "Sign in with Google"
 *   - No registration form, no invitations, no activation code entry.
 *   - Account activation is handled entirely by the desktop application.
 *
 * If Supabase env vars are missing, we render a helpful config message
 * instead of crashing — useful for first-time deployments.
 *
 * ─── TEMPORARY MOCK AUTH ────────────────────────────────────────────────────
 * When NEXT_PUBLIC_MOCK_AUTH_ENABLED=true, an additional "Mock Admin Login"
 * button is rendered below the Google button. It bypasses Google OAuth and
 * signs in as a mock administrator with full permissions. This is for
 * development and testing only. See src/lib/auth/mock-auth.ts.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { AlertCircle, GraduationCap, ShieldCheck, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

export function LoginScreen() {
  const { signInWithGoogle, signInWithMock, configured, error, mockAuthEnabled } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [mockBusy, setMockBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      // OAuth redirect takes time; reset only if we didn't redirect.
      setTimeout(() => setBusy(false), 3000);
    }
  };

  const handleMockSignIn = async () => {
    setMockBusy(true);
    try {
      await signInWithMock();
    } finally {
      setMockBusy(false);
    }
  };

  return (
    <main className="brand-gradient relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      {/* Brand hero */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <GraduationCap className="h-9 w-9" />
        </div>
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {t("app.name")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-border/60 bg-card/95 backdrop-blur">
        <CardContent className="p-6">
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
              <p className="text-destructive-foreground">{error}</p>
            </div>
          )}

          <Button
            onClick={handleSignIn}
            disabled={!configured || busy}
            className="w-full touch-target"
            size="lg"
          >
            <GoogleIcon className="mr-2 h-5 w-5" />
            {t("auth.signin.google")}
          </Button>

          {/* ─── TEMPORARY MOCK AUTH ───────────────────────────────────────
              Only rendered when NEXT_PUBLIC_MOCK_AUTH_ENABLED=true.
              Bypasses Google OAuth and signs in as a mock administrator. */}
          {mockAuthEnabled && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{t("auth.signin.or")}</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                onClick={handleMockSignIn}
                disabled={mockBusy}
                variant="outline"
                className="w-full touch-target"
                size="lg"
              >
                <FlaskConical className="mr-2 h-5 w-5 text-warning" />
                {t("auth.signin.mock")}
              </Button>

              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {t("auth.signin.mockHint")}
              </p>
            </>
          )}

          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("auth.signin.secure")}
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
        {t("auth.signin.help")}
      </p>
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