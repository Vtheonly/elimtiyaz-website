"use client";

/**
 * AuthProvider — Supabase Google OAuth + account status gating.
 *
 * Workflow (per user requirements):
 *   1. User signs in with Google via Supabase Auth.
 *   2. We listen to onAuthStateChange.
 *   3. On SIGN_IN, we fetch the user_profiles row linked to auth.users.id.
 *   4. If status === 'active' → load parent profile + children, show dashboard.
 *   5. If status === 'pending' → show "account not activated" screen.
 *   6. If status === 'suspended' → show "account suspended" screen.
 *   7. If status === 'deleted' OR no profile → show rejected screen.
 *
 * This portal does NOT implement account registration, invitations, account
 * activation, or role assignment — those workflows belong to the desktop
 * application, which remains the authoritative system for account
 * provisioning, activation, role assignment, and tenant management.
 *
 * Session persistence: Supabase Auth manages the JWT + refresh token in
 * cookies/localStorage. This provider wraps that with React state so
 * components can subscribe via useAuth().
 *
 * SECURITY (SEC-007, task T-009): the mock-admin authentication system
 * (mock-auth.ts + signInWithMock + localStorage hydration of
 * 'mock-auth-session') was REMOVED on 2026-08-29. Google OAuth via Supabase
 * is the ONLY authentication path. Do not reintroduce mock sessions — a
 * planted localStorage key used to hydrate a staff-grade session with no
 * authentication at all.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { unregisterDeviceToken, autoRegisterFcmAfterFirstGesture } from "@/lib/hooks/fcm-registration";
import type { ParentRow, StudentRow, UserProfileRow } from "@/lib/types/database";

type AuthState = "loading" | "unauthenticated" | "pending" | "active" | "suspended" | "rejected";

interface AuthContextValue {
  state: AuthState;
  user: UserProfileRow | null;
  parent: ParentRow | null;
  children: StudentRow[];
  error: string | null;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** The OAuth failure-redirect params, consumed off the URL after mount. */
const OAUTH_ERROR_PARAMS = ["error", "error_code", "error_description"] as const;

/**
 * AUTH-401 / T-521 (2026-10-13): Supabase redirects OAuth FAILURES back to
 * the site as URL params — the live case is
 * ?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A…
 * (a double-encoded copy may also land in the hash). The app used to ignore
 * these params entirely: the visitor landed back on the login screen with
 * no session and NO explanation of what happened (owner-reported: “the
 * authentication process does not continue”). Read the redirect ONCE at
 * mount and map the class to a stable code the login screen localizes (the
 * AUTH-200 pattern). The underlying owner-side fix (correct the Supabase
 * Google provider's client credentials) is documented in the hub runbook
 * docs/operations/portal-google-oauth.md §6.
 */
function readOauthErrorRedirectCode(): string | null {
  if (typeof window === "undefined") return null;
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const carrier = searchParams.has("error")
    ? searchParams
    : hashParams.has("error")
      ? hashParams
      : null;
  if (!carrier) return null;
  const description = carrier.get("error_description") ?? "";
  // AUTH-401 signature (live-verified 2026-10-13): Google rejected the token
  // exchange — actionable only on the owner side (the Supabase Google
  // provider's client secret is invalid; the hub runbook §6 has the fix).
  return /unable to exchange external code/i.test(description)
    ? "oauth_exchange_failed"
    : "oauth_failed";
}

export function AuthProvider({ children: reactChildren }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? "loading" : "unauthenticated"
  );
  const [user, setUser] = useState<UserProfileRow | null>(null);
  const [parent, setParent] = useState<ParentRow | null>(null);
  const [childrenList, setChildrenList] = useState<StudentRow[]>([]);
  // AUTH-401 / T-521: seeded from the OAuth failure-redirect params (if any)
  // on the very first client render; every later mutation flows through
  // setError as before (signInWithGoogle clears it on retry).
  const [error, setError] = useState<string | null>(readOauthErrorRedirectCode);

  const profileIdRef = useRef<string | null>(null);

  /**
   * Load the user's profile, parent record, and children from Supabase.
   * Returns the auth state the provider should transition to.
   * All queries are RLS-protected — a parent can only ever see their own
   * parent row and their own children.
   */
  const loadProfile = useCallback(async (): Promise<AuthState> => {
    if (!supabase) return "unauthenticated";

    // AUTH-201 (20th session, 2026-09-02): check the LOCAL session FIRST.
    // `getUser()` throws AuthSessionMissingError when no session exists —
    // which is the NORMAL state for every fresh visitor. Calling it
    // unconditionally (a) logged a scary-looking console.error on every
    // fresh page load and (b) set the login screen's destructive alert to
    // the raw English "Auth session missing!" string BEFORE the visitor
    // ever clicked sign-in (owner-reported console evidence). getSession()
    // is a local read that never throws — no round-trip, no error state.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return "unauthenticated";

    // A session exists → validate it server-side (detects revoked users
    // and stale tokens). A validation failure here is NOT user-actionable
    // on the login screen (supabase-js fires SIGNED_OUT itself when the
    // token refresh fails), so: warn in the console for diagnostics, treat
    // as signed out, and deliberately do NOT setError — the visitor simply
    // sees the login screen again.
    const {
      data: { user: authUser },
      error: getUserErr,
    } = await supabase.auth.getUser();

    if (getUserErr) {
      console.warn(
        "[auth] session validation failed, treating as signed out:",
        getUserErr.message,
      );
      return "unauthenticated";
    }

    if (!authUser) return "unauthenticated";

    // Fetch the user_profiles row linked to this auth user.
    // The on_auth_user_created trigger (migration 0002) guarantees a row
    // exists; if it's missing, the DB hasn't been migrated.
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.error("[auth] error fetching user_profiles:", profileErr);
      setError(profileErr.message);
      return "unauthenticated";
    }

    if (!profile) {
      setUser(null);
      setParent(null);
      setChildrenList([]);
      return "pending";
    }

    const typedProfile = profile as UserProfileRow;
    setUser(typedProfile);
    profileIdRef.current = typedProfile.id;
    setError(null);

    const status = typedProfile.status;
    if (status === "suspended" || status === "deleted") {
      setParent(null);
      setChildrenList([]);
      return status === "suspended" ? "suspended" : "rejected";
    }
    if (status === "pending") {
      setParent(null);
      setChildrenList([]);
      return "pending";
    }

    // status === 'active' → load the parent profile + children.
    // RLS on `parents` returns only the row where auth_user_id = auth.uid().
    const { data: parentRow, error: parentErr } = await supabase
      .from("parents")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (parentErr) {
      console.error("[auth] error fetching parent:", parentErr);
      setError(parentErr.message);
      setParent(null);
      setChildrenList([]);
      return "pending";
    }

    if (parentRow) {
      setParent(parentRow as ParentRow);

      const { data: kids, error: kidsErr } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", (parentRow as ParentRow).id)
        .is("deleted_at", null)
        .order("first_name", { ascending: true });

      if (kidsErr) {
        console.error("[auth] error fetching students:", kidsErr);
        setChildrenList([]);
      } else {
        setChildrenList((kids ?? []) as StudentRow[]);
      }

      return "active";
    }

    // T-413 (STUDENT-103): the account may be STUDENT-bound — the desktop's
    // student-application approval binds students.auth_user_id (migration
    // 0116). Resolve the caller's OWN student row (the students_student_self
    // RLS policy) and, through it, their family context:
    //   - childrenList = the student themselves (self-scoped — a student
    //     never sees their siblings through their own login);
    //   - parent = the family row read through parents_student_sees_own
    //     (0116 — the portal's family-context header; the FINANCIAL rows
    //     remain parent-role-gated by design: the parent's own portal owns
    //     the billing surfaces).
    const { data: selfStudent, error: selfStudentErr } = await supabase
      .from("students")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (selfStudentErr) {
      console.error("[auth] error fetching self student:", selfStudentErr);
    }

    if (selfStudent) {
      setChildrenList([selfStudent as StudentRow]);

      const { data: selfParent, error: selfParentErr } = await supabase
        .from("parents")
        .select("*")
        .eq("id", (selfStudent as StudentRow).parent_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (selfParentErr) {
        console.error("[auth] error fetching own parent row:", selfParentErr);
        setParent(null);
      } else {
        setParent((selfParent as ParentRow) ?? null);
      }

      return "active";
    }

    // Active user but no parent binding yet — admin activated the account
    // but hasn't linked it to a parent profile. Treat as pending.
    setParent(null);
    setChildrenList([]);
    return "pending";
  }, []);

  const refresh = useCallback(async () => {
    setState("loading");
    const next = await loadProfile();
    setState(next);
  }, [loadProfile]);

  // T-036 / PUSH-103: attempt FCM auto-registration after the FIRST user
  // gesture. Browsers only allow the permission prompt from a user-initiated
  // event, so this waits for the first pointerdown/keydown after the profile
  // is available. One attempt per browser profile (localStorage guard inside
  // the helper); the Profile view toggle remains the explicit control and is
  // unaffected.
  useEffect(() => {
    const teardown = autoRegisterFcmAfterFirstGesture(user?.id);
    return () => teardown();
  }, [user?.id]);

  // AUTH-401 / T-521 (2026-10-13): Supabase redirects OAuth FAILURES back to
  // the site as URL params — the live case is
  // ?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A…
  // (a double-encoded copy may also land in the hash). The app used to ignore
  // these params entirely: the visitor landed back on the login screen with
  // no session and NO explanation of what happened (owner-reported). The
  // error state itself is seeded by readOauthErrorRedirectCode (the lazy
  // initializer above); this effect only cleans the CONSUMED params off the
  // URL (search + hash copy) so a refresh or bookmark doesn't re-trigger the
  // message — everything else in the URL survives untouched.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (!searchParams.has("error") && !hashParams.has("error")) return;
    for (const params of [searchParams, hashParams]) {
      for (const key of OAUTH_ERROR_PARAMS) params.delete(key);
    }
    const qs = searchParams.toString();
    const hs = hashParams.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${hs ? `#${hs}` : ""}`,
    );
  }, []);

  // Subscribe to auth state changes once on mount.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;

    const init = async () => {
      const next = await loadProfile();
      if (mounted) setState(next);
    };

    init();

    const { data: sub } = supabase!.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setParent(null);
        setChildrenList([]);
        setState("unauthenticated");
      } else {
        init();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          // Force account chooser so users with multiple Google accounts
          // can pick the right one.
          prompt: "select_account",
        },
      },
    });
    if (oauthErr) {
      console.error("[auth] Google OAuth error:", oauthErr);
      // AUTH-200 (19th session, 2026-09-02): with the Google provider
      // DISABLED server-side, the live authorize endpoint answers
      // 400 {"error_code":"validation_failed","msg":"Unsupported provider:
      // provider is not enabled"} (verified live). Surfacing that raw
      // English server string to a parent is meaningless — set a STABLE
      // code that the login screen maps to a localized, actionable message.
      // The owner-side fix (enable the provider) is documented in the hub
      // runbook docs/operations/portal-google-oauth.md.
      const providerDisabled = /unsupported provider|provider is not enabled/i.test(
        oauthErr.message ?? "",
      );
      setError(providerDisabled ? "provider_disabled" : oauthErr.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // SYNC-105 fix (2026-08-30), two parts:
    //   1. Deactivate THIS device's FCM token first — the old flow left
    //      is_active=true rows behind, so push notifications kept reaching
    //      a signed-out device. (Must run while the session is still valid —
    //      the RPC verifies the caller.)
    //   2. Revoke only the LOCAL session. The old `scope: "global"` revoked
    //      every session on every device — a parent signing out on their
    //      phone silently killed the family's tablet + laptop sessions.
    const profileId = profileIdRef.current;
    if (profileId) {
      try {
        await unregisterDeviceToken(profileId);
      } catch {
        // Non-fatal: proceed with sign-out even if the token cleanup fails.
      }
    }
    await supabase.auth.signOut({ scope: "local" });
    setUser(null);
    setParent(null);
    setChildrenList([]);
    setState("unauthenticated");
    router.refresh();
  }, [router]);

  const value: AuthContextValue = {
    state,
    user,
    parent,
    children: childrenList,
    error,
    configured: isSupabaseConfigured,
    signInWithGoogle,
    signOut,
    refresh,
  };

  return <AuthContext.Provider value={value}>{reactChildren}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}