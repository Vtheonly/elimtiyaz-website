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
 * ─── TEMPORARY MOCK AUTH (DEVELOPMENT & TESTING ONLY) ───────────────────────
 * During the testing phase, a direct "Admin" entry allows entering the app
 * with full administrator permissions without Google OAuth. This is ALWAYS
 * functional (no feature-flag gating) so testers can use the app immediately.
 * Remove this once production authentication is implemented.
 * See src/lib/auth/mock-auth.ts.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getMockSession,
  saveMockSession,
  clearMockSession,
  isMockUser,
} from "@/lib/auth/mock-auth";
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
  // ─── TEMPORARY MOCK AUTH ───────────────────────────────────────────────
  // Mock sign-in: bypasses Google OAuth and sets a mock admin session.
  // Always functional during the testing phase.
  signInWithMock: () => Promise<void>;
  // True when the current session is a mock session (not a real Supabase
  // session). Used to show a "mock mode" indicator in the UI.
  isMockSession: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children: reactChildren }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? "loading" : "unauthenticated"
  );
  const [user, setUser] = useState<UserProfileRow | null>(null);
  const [parent, setParent] = useState<ParentRow | null>(null);
  const [childrenList, setChildrenList] = useState<StudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // ─── TEMPORARY MOCK AUTH ───────────────────────────────────────────────
  // Tracks whether the current session is a mock session. See mock-auth.ts.
  const [isMockSession, setIsMockSession] = useState(false);

  const profileIdRef = useRef<string | null>(null);

  /**
   * Load the user's profile, parent record, and children from Supabase.
   * Returns the auth state the provider should transition to.
   * All queries are RLS-protected — a parent can only ever see their own
   * parent row and their own children.
   */
  const loadProfile = useCallback(async (): Promise<AuthState> => {
    if (!supabase) return "unauthenticated";

    const {
      data: { user: authUser },
      error: getUserErr,
    } = await supabase.auth.getUser();

    if (getUserErr) {
      console.error("[auth] getUser error:", getUserErr);
      setError(getUserErr.message);
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

    if (!parentRow) {
      // Active user but no parent binding yet — admin activated the account
      // but hasn't linked it to a parent profile. Treat as pending.
      setParent(null);
      setChildrenList([]);
      return "pending";
    }

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
  }, []);

  const refresh = useCallback(async () => {
    setState("loading");
    const next = await loadProfile();
    setState(next);
  }, [loadProfile]);

  // ─── TEMPORARY MOCK AUTH ───────────────────────────────────────────────
  // On mount, check for an existing mock session in localStorage. If present,
  // hydrate the auth state from it instead of querying Supabase. This runs
  // before the Supabase subscription so the mock session takes priority.
  useEffect(() => {
    const mockSession = getMockSession();
    if (mockSession && isMockUser(mockSession.user.auth_user_id)) {
      setUser(mockSession.user);
      setParent(mockSession.parent);
      setChildrenList(mockSession.children);
      setIsMockSession(true);
      setError(null);
      setState("active");
    }
  }, []);

  // Subscribe to auth state changes once on mount.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // If a mock session is active, skip the Supabase subscription entirely
    // so we don't override the mock state with a real (unauthenticated)
    // Supabase session.
    if (isMockSession) return;

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
  }, [loadProfile, isMockSession]);

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
      setError(oauthErr.message);
    }
  }, []);

  // ─── TEMPORARY MOCK AUTH ───────────────────────────────────────────────
  // Mock sign-in: bypasses Google OAuth entirely. Creates a mock admin
  // session in localStorage and transitions to the "active" state so the
  // user lands directly on the admin dashboard.
  // ALWAYS functional during the testing phase — remove with mock auth.
  const signInWithMock = useCallback(async () => {
    setError(null);
    const session = saveMockSession();
    setUser(session.user);
    setParent(session.parent);
    setChildrenList(session.children);
    setIsMockSession(true);
    setState("active");
  }, []);

  const signOut = useCallback(async () => {
    // ─── TEMPORARY MOCK AUTH ─────────────────────────────────────────────
    // If this is a mock session, clear the mock session from localStorage
    // and skip the Supabase signOut call (there's no real session to revoke).
    if (isMockSession) {
      clearMockSession();
      setIsMockSession(false);
      setUser(null);
      setParent(null);
      setChildrenList([]);
      setState("unauthenticated");
      router.refresh();
      return;
    }

    if (!supabase) return;
    // Revoke the session server-side before clearing local state.
    await supabase.auth.signOut({ scope: "global" });
    setUser(null);
    setParent(null);
    setChildrenList([]);
    setState("unauthenticated");
    router.refresh();
  }, [router, isMockSession]);

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
    // ─── TEMPORARY MOCK AUTH ─────────────────────────────────────────────
    signInWithMock,
    isMockSession,
  };

  return <AuthContext.Provider value={value}>{reactChildren}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}