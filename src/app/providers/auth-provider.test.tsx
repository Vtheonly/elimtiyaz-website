/**
 * Regression tests for SEC-007 (task T-009).
 *
 * The AuthProvider used to hydrate a FULL mock-administrator session from a
 * `mock-auth-session` localStorage key on every mount — with NO check of the
 * NEXT_PUBLIC_MOCK_AUTH_ENABLED feature flag. Anyone who planted that key (or
 * any leftover dev session) got staff-grade permissions (50+ permissions incl.
 * admin.users.manage, finance.payments.refund) with no authentication at all.
 *
 * T-009 removed the whole mock-auth system. These tests pin the fixed
 * behaviour:
 *   1. a planted `mock-auth-session` localStorage key must produce NO
 *      authenticated state;
 *   2. the auth context must no longer expose the mock-auth API
 *      (signInWithMock / isMockSession).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// The Supabase client is fully mocked: getUser reports no real session, so the
// ONLY way the provider could reach "active" is the (removed) mock hydration.
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { AuthProvider, useAuth } from "./auth-provider";

/** Captures the live auth context value for assertions. */
let ctx: ReturnType<typeof useAuth> | null = null;
function Probe() {
  ctx = useAuth();
  return null;
}

function renderAuthProvider(children?: ReactNode) {
  return render(<AuthProvider>{children ?? <Probe />}</AuthProvider>);
}

beforeEach(() => {
  ctx = null;
  localStorage.clear();
});

describe("SEC-007 — mock-auth removal (T-009)", () => {
  it("a planted 'mock-auth-session' localStorage key produces NO authenticated state", async () => {
    // Shape crafted to satisfy the OLD (removed) hydration path:
    // getMockSession() JSON-parses this, isMockUser() matched the sentinel id.
    localStorage.setItem(
      "mock-auth-session",
      JSON.stringify({
        user: { auth_user_id: "mock-admin-user-id", status: "active" },
        parent: { id: "mock-admin-parent-id" },
        children: [],
        roles: ["admin", "super_admin"],
        permissions: ["admin.users.manage", "finance.payments.refund"],
        signedInAt: "2024-01-01T00:00:00.000Z",
      })
    );

    renderAuthProvider();

    // Wait for the initial "loading" state to settle.
    await waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.state).not.toBe("loading");
    });

    // The planted key must NOT hydrate a session: no active state, no user.
    expect(ctx!.state).toBe("unauthenticated");
    expect(ctx!.user).toBeNull();
    expect(ctx!.parent).toBeNull();
    expect(ctx!.children).toEqual([]);
  });

  it("exposes no mock-auth API on the auth context", () => {
    renderAuthProvider();

    expect(ctx).not.toBeNull();
    const value = ctx as unknown as Record<string, unknown>;
    expect(value["signInWithMock"]).toBeUndefined();
    expect(value["isMockSession"]).toBeUndefined();
    // The real OAuth path must still be exposed.
    expect(typeof value["signInWithGoogle"]).toBe("function");
    expect(typeof value["signOut"]).toBe("function");
  });

  it("with no localStorage key and no Supabase session, state is unauthenticated", async () => {
    renderAuthProvider();

    await waitFor(() => {
      expect(ctx!.state).not.toBe("loading");
    });

    expect(ctx!.state).toBe("unauthenticated");
    expect(ctx!.user).toBeNull();
  });
});
