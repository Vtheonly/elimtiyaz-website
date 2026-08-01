"use client";

/**
 * ActivationCodeScreen — Path A self-service activation.
 *
 * Per Entire_Project_Plan.txt §02.08: a parent who has signed in with Google
 * but whose user_profiles.status is still 'pending' can submit a 6–7 digit
 * numeric activation code that the school issued via the desktop app.
 *
 * This screen calls the `bind-activation-code` Supabase Edge Function, which
 * atomically binds the caller's auth_user_id to the master parents row
 * referenced by the code, flips user_profiles.status to 'active', and grants
 * the 'parent' role.
 *
 * Path B (admin approval) is also offered as a fallback — the user can
 * dismiss this screen and wait for the admin to manually approve their
 * account from the desktop app.
 */

import { useState } from "react";
import { useT } from "@/lib/i18n/use-t";
import { useAuth } from "@/app/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  /** Called when the user wants to dismiss this screen and fall back to Path B (admin approval). */
  onDismiss: () => void;
}

type Phase = "form" | "submitting" | "success" | "error";

export function ActivationCodeScreen({ onDismiss }: Props) {
  const { t } = useT();
  const { refresh } = useAuth();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg(t("activation.code.error.generic"));
      setPhase("error");
      return;
    }

    const trimmed = code.trim();
    if (!/^\d{6,7}$/.test(trimmed)) {
      setErrorMsg(t("activation.code.error.invalid"));
      setPhase("error");
      return;
    }

    setPhase("submitting");
    setErrorMsg(null);

    try {
      // Get the current session's access token (needed by the Edge Function).
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session) {
        throw new Error("No active session.");
      }
      const accessToken = sessionData.session.access_token;

      // Determine the Edge Function URL. We assume the function is deployed
      // to the same Supabase project the portal talks to (its URL is in
      // NEXT_PUBLIC_SUPABASE_URL).
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/bind-activation-code`;

      const resp = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          // Supabase Edge Functions also require the anon key as apikey.
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const msg = data?.error ?? "";
        if (/expired/i.test(msg)) {
          setErrorMsg(t("activation.code.error.expired"));
        } else if (/already.*active/i.test(msg)) {
          // Account is already active — just refresh.
          setPhase("success");
          setTimeout(() => refresh(), 1500);
          return;
        } else {
          setErrorMsg(t("activation.code.error.invalid"));
        }
        setPhase("error");
        return;
      }

      setPhase("success");
      toast.success(t("activation.code.success.title"));
      // Give the user a moment to read the success message, then refresh
      // the auth state so the portal re-evaluates the user_profiles.status.
      setTimeout(() => refresh(), 1500);
    } catch (err) {
      console.error("[activation-code] submit failed:", err);
      setErrorMsg(t("activation.code.error.generic"));
      setPhase("error");
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-4 py-8">
      <Card className="w-full border-border/60">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">{t("activation.code.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("activation.code.subtitle")}</p>
        </CardHeader>
        <CardContent>
          {phase === "success" ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <p className="font-medium">{t("activation.code.success.title")}</p>
              <p className="text-sm text-muted-foreground">{t("activation.code.success.body")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activation-code-input">{t("activation.code.input")}</Label>
                <Input
                  id="activation-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6,7}"
                  maxLength={7}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => {
                    // Strip non-digits as the user types.
                    setCode(e.target.value.replace(/\D/g, ""));
                    if (phase === "error") setPhase("form");
                  }}
                  placeholder="123456"
                  className="text-center text-2xl tracking-[0.5em]"
                  disabled={phase === "submitting"}
                  autoFocus
                />
              </div>

              {phase === "error" && errorMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={phase === "submitting" || code.length < 6}
                className={cn("w-full touch-target")}
              >
                {phase === "submitting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {phase === "submitting" ? t("activation.code.submitting") : t("activation.code.submit")}
              </Button>

              <div className="space-y-2 pt-2">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-2 text-xs text-muted-foreground">— ou —</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDismiss}
                  className="w-full text-muted-foreground"
                  disabled={phase === "submitting"}
                >
                  {t("activation.code.dontHaveCode")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
