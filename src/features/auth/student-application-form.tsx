"use client";

/**
 * StudentApplicationForm — the T-413 website-side enrollment form.
 *
 * STUDENT-102 (migration 0116 §1/§2): a pending user (a parent whose account
 * awaits admin approval) can attach the structured enrollment application
 * for their child BEFORE the admin approves. The payload lands in
 * account_approval_requests.student_application through the RLS-guarded
 * self-update path (auth_user_id = auth.uid() AND status = 'pending'; the
 * column-guard trigger forbids touching anything else) — the desktop
 * ApprovalsTab then pre-fills its student-creation form from it, and the
 * approve_student_application composite enrolls the child in one
 * transaction.
 *
 * Data sources: the user's OWN pending request (the 0116 own-pending SELECT
 * policy) — read once on mount, PATCHed on submit, re-read to confirm the
 * save (the zero-row no-op guard: RLS-500's silent-empty lesson).
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { GRADE_LEVEL_OPTIONS } from "@/lib/student-application";
import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pencil,
} from "lucide-react";
import type { StudentApplicationPayload } from "@/lib/types/database";

type Phase = "loading" | "form" | "saving" | "saved" | "error" | "unavailable";

export function StudentApplicationForm() {
  const { user, refresh } = useAuth();
  const { t } = useT();

  const [phase, setPhase] = useState<Phase>("loading");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState<StudentApplicationPayload>({});

  // Load the user's OWN pending request (the 0116 own-pending SELECT policy)
  // and any application they already attached.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase || !user) {
        if (!cancelled) setPhase("unavailable");
        return;
      }
      const { data, error } = await supabase
        .from("account_approval_requests")
        .select("id, student_application")
        .eq("auth_user_id", user.auth_user_id)
        .eq("status", "pending")
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // The 0116 column/policy is not deployed, or the request row is not
        // visible — the form must degrade honestly (never block the
        // activation screen).
        console.warn("[student-application] request lookup unavailable:", error.message);
        setPhase("unavailable");
        return;
      }
      if (!data) {
        setPhase("unavailable");
        return;
      }
      setRequestId(data.id as string);
      const existing = data.student_application as StudentApplicationPayload | null;
      if (existing?.student?.first_name || existing?.grade_level_code) {
        setForm(existing);
        setPhase("saved");
      } else {
        setPhase("form");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !requestId) return;
    setPhase("saving");
    setErrorMsg(null);

    const payload: StudentApplicationPayload = {
      student: {
        first_name: form.student?.first_name?.trim() || undefined,
        last_name: form.student?.last_name?.trim() || undefined,
        date_of_birth: form.student?.date_of_birth || undefined,
        gender: form.student?.gender,
      },
      grade_level_code: form.grade_level_code || undefined,
      note: form.note?.trim() || undefined,
    };

    if (!payload.student?.first_name || !payload.student?.last_name) {
      setErrorMsg(t("application.error.required"));
      setPhase("form");
      return;
    }

    const { data: updated, error } = await supabase
      .from("account_approval_requests")
      .update({ student_application: payload })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id, student_application")
      .maybeSingle();

    if (error) {
      console.error("[student-application] save failed:", error);
      setErrorMsg(error.message);
      setPhase("error");
      return;
    }

    // The zero-row no-op guard (the RLS-500 lesson): a "successful" update
    // that returned no row saved NOTHING — treat it as an error, never as
    // a submitted application.
    if (!updated) {
      setErrorMsg(t("application.error.notSaved"));
      setPhase("error");
      return;
    }

    setForm(updated.student_application as StudentApplicationPayload);
    setPhase("saved");
    // The admin may have approved while we were filling the form —
    // re-resolve the session (a now-active account moves past this screen).
    void refresh();
  }

  if (phase === "unavailable") return null;

  // The submit-in-flight flag (kept separate from `phase` so the JSX's
  // phase narrowing stays sound for the strict build).
  const isSaving = phase === "saving";

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/95 backdrop-blur">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t("application.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("application.subtitle")}
            </p>
          </div>
        </div>

        {phase === "saved" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium text-foreground">
                  {t("application.saved.title")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("application.saved.body")}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <li>
                    {form.student?.first_name} {form.student?.last_name}
                    {form.student?.date_of_birth
                      ? ` · ${form.student.date_of_birth}`
                      : ""}
                  </li>
                  {form.grade_level_code && (
                    <li>
                      {GRADE_LEVEL_OPTIONS.find(
                        (o) => o.value === form.grade_level_code,
                      )?.label ?? form.grade_level_code}
                    </li>
                  )}
                  {form.note && <li className="italic">« {form.note} »</li>}
                </ul>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full touch-target"
              onClick={() => setPhase("form")}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t("application.edit")}
            </Button>
          </div>
        )}

        {(phase === "form" || phase === "error") && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="app-student-first" className="text-xs">
                  {t("application.student.firstName")} *
                </Label>
                <Input
                  id="app-student-first"
                  value={form.student?.first_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      student: { ...f.student, first_name: e.target.value },
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="app-student-last" className="text-xs">
                  {t("application.student.lastName")} *
                </Label>
                <Input
                  id="app-student-last"
                  value={form.student?.last_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      student: { ...f.student, last_name: e.target.value },
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="app-student-dob" className="text-xs">
                  {t("application.student.dob")}
                </Label>
                <Input
                  id="app-student-dob"
                  type="date"
                  value={form.student?.date_of_birth ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      student: { ...f.student, date_of_birth: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="app-student-gender" className="text-xs">
                  {t("application.student.gender")}
                </Label>
                <select
                  id="app-student-gender"
                  value={form.student?.gender ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      student: {
                        ...f.student,
                        gender: (e.target.value || undefined) as
                          | "male"
                          | "female"
                          | "other"
                          | undefined,
                      },
                    }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">—</option>
                  <option value="male">{t("application.student.male")}</option>
                  <option value="female">{t("application.student.female")}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="app-student-level" className="text-xs">
                {t("application.student.level")}
              </Label>
              <select
                id="app-student-level"
                value={form.grade_level_code ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, grade_level_code: e.target.value || undefined }))
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">—</option>
                {GRADE_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="app-student-note" className="text-xs">
                {t("application.note")}
              </Label>
              <textarea
                id="app-student-note"
                value={form.note ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t("application.notePlaceholder")}
              />
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              className="w-full touch-target"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("application.saving")}
                </>
              ) : (
                t("application.submit")
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
