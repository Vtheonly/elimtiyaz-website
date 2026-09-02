/**
 * AUTH-201 — pre-sign-in session-noise regression suite (20th session, 2026-09-02).
 *
 * Problem (owner-pasted console evidence from the production Vercel
 * deployment): on EVERY fresh visit — before the visitor clicked anything —
 * the portal logged
 *   [auth] getUser error: AuthSessionMissingError: Auth session missing!
 * and (worse) surfaced the raw English string in the login screen's red
 * destructive alert, because loadProfile() called auth.getUser()
 * unconditionally and treated the NORMAL signed-out state as an error.
 *
 * Fix (T-120): loadProfile() reads the LOCAL session first (getSession —
 * never throws, no network round-trip) and returns "unauthenticated"
 * silently when none exists. getUser() runs ONLY when a session exists, and
 * a validation failure there is logged at WARN level without setError (the
 * visitor simply sees the login screen; supabase-js fires SIGNED_OUT itself
 * when the token refresh fails).
 *
 * These tests pin:
 *   1. fresh visit → unauthenticated, NO error state, getUser NOT called;
 *   2. session exists + getUser fails → unauthenticated, NO error state,
 *      console.warn (not console.error);
 *   3. session + valid user + active profile → "active" (the authenticated
 *      flow is preserved by the getSession-first refactor);
 *   4. genuine profile-fetch failure → error state IS set (real backend
 *      errors remain surfaced — only the no-session noise was removed).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: mocks.from,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { AuthProvider, useAuth } from "./auth-provider";

function renderAuth() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

/** Fluent table mock: from(table).select().eq().is().maybeSingle()/order() */
function tableMock(row: unknown) {
  const chain: Record<string, unknown> = {
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  return chain;
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  mocks.getSession.mockReset();
  mocks.getUser.mockReset();
  mocks.onAuthStateChange.mockReset().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mocks.from.mockReset();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("AUTH-201 — the signed-out state is silent (no error, no noise)", () => {
  it("fresh visit with NO session: unauthenticated, no error state, getUser never called", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const { result } = renderAuth();

    await waitFor(() => {
      expect(result.current.state).not.toBe("loading");
    });

    expect(result.current.state).toBe("unauthenticated");
    // The destructive alert's data source must stay empty.
    expect(result.current.error).toBeNull();
    // The server round-trip is skipped entirely for signed-out visitors.
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("session exists but server validation fails: unauthenticated, warn (not error), no error state", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "u1" } } },
      error: null,
    });
    // e.g. AuthSessionMissingError / revoked session surfaced by getUser.
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });

    const { result } = renderAuth();

    await waitFor(() => {
      expect(result.current.state).not.toBe("loading");
    });

    expect(result.current.state).toBe("unauthenticated");
    expect(result.current.error).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    // The old defect: console.error + raw "Auth session missing!" alert.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("session + valid user + active profile: the authenticated flow still reaches 'active'", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "auth-u1" } } },
      error: null,
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-u1" } },
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "user_profiles")
        return tableMock({
          id: "p1",
          auth_user_id: "auth-u1",
          status: "active",
          display_name: "Parent Test",
        });
      if (table === "parents")
        return tableMock({ id: "parent-1", auth_user_id: "auth-u1", first_name: "", last_name: "Test" });
      if (table === "students") return tableMock([]);
      return tableMock(null);
    });

    const { result } = renderAuth();

    await waitFor(() => {
      expect(result.current.state).toBe("active");
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.parent).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("genuine profile-fetch failure still sets the error state (surfacing preserved)", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "auth-u1" } } },
      error: null,
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-u1" } }, error: null });
    const failing = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "relation does not exist" } }),
    };
    mocks.from.mockReturnValue(failing);

    const { result } = renderAuth();

    await waitFor(() => {
      expect(result.current.state).not.toBe("loading");
    });

    expect(result.current.error).toBe("relation does not exist");
    expect(errorSpy).toHaveBeenCalled();
  });
});
