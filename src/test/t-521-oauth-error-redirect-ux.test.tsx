/**
 * AUTH-401 / T-521 — OAuth failure-redirect UX regression suite (2026-10-13).
 *
 * Problem (owner-reported, live): after picking a Google account, sign-in
 * died with Supabase redirecting the FAILURE back to the site as URL params:
 *   ?error=server_error&error_code=unexpected_failure
 *   &error_description=Unable+to+exchange+external+code%3A+4%2F0A…
 * (a double-encoded copy also landed in the hash). The app ignored these
 * params entirely — the visitor landed back on the login screen with no
 * session and NO explanation ("the 6-digit activation code never appeared").
 *
 * Root cause (live-verified via the Google token-endpoint probe, hub runbook
 * §6): the Supabase Google provider's stored client secret is INVALID (a
 * 64-char hex string, not a Google GOCSPX- secret) — Google answers 401
 * {"error":"invalid_client","error_description":"The provided client secret
 * is invalid."} to the exchange Supabase performs server-side. That half is
 * owner-gated (hub docs/operations/portal-google-oauth.md §6).
 *
 * This suite pins the CLIENT-side half (the AUTH-200 pattern extended):
 *   1. the auth-provider CONSUMES the redirect params on mount, maps the
 *      exchange-failure signature to the stable code "oauth_exchange_failed"
 *      (any other OAuth error redirect → "oauth_failed"), and cleans the URL;
 *   2. the login screen renders localized messages for both codes;
 *   3. the dictionary carries both messages in EVERY locale (fr/ar/en);
 *   4. the OAuth SUCCESS path (?code=…) is untouched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { translate, LOCALES } from "@/lib/i18n/dictionary";

// The Supabase client is fully mocked: no local session, so the provider
// settles to "unauthenticated" and the ONLY error state can come from the
// redirect-param consumption under test.
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
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

import { AuthProvider, useAuth } from "@/app/providers/auth-provider";

const SRC = join(__dirname, "..");

/** Render useAuth() inside the AuthProvider, as the app does. */
function renderAuth() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

const LIVE_DESCRIPTION = "Unable to exchange external code: 4/0Adummy-probe-code";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("AUTH-401 — the OAuth failure redirect is consumed, not swallowed", () => {
  it("the live exchange-failure redirect sets the stable code AND cleans the URL", async () => {
    window.history.replaceState(
      null,
      "",
      `/?error=server_error&error_code=unexpected_failure&error_description=${encodeURIComponent(LIVE_DESCRIPTION)}`,
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.state).toBe("unauthenticated"));
    expect(result.current.error).toBe("oauth_exchange_failed");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("any other OAuth error redirect maps to the generic code (raw server text never shown)", async () => {
    window.history.replaceState(
      null,
      "",
      "/?error=server_error&error_code=unexpected_failure&error_description=Something%20else",
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.state).toBe("unauthenticated"));
    expect(result.current.error).toBe("oauth_failed");
    expect(window.location.search).toBe("");
  });

  it("the hash-carried error copy (observed live) is consumed too; unrelated params survive", async () => {
    window.history.replaceState(
      null,
      "",
      `/?error=server_error&error_code=unexpected_failure&error_description=${encodeURIComponent(LIVE_DESCRIPTION)}` +
        `#error=server_error&error_code=unexpected_failure&error_description=${encodeURIComponent(LIVE_DESCRIPTION)}&sb=`,
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.state).toBe("unauthenticated"));
    expect(result.current.error).toBe("oauth_exchange_failed");
    // The query is fully cleaned; the hash keeps ONLY its non-error params.
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#sb=");
  });

  it("a clean URL leaves no error state", async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.state).toBe("unauthenticated"));
    expect(result.current.error).toBeNull();
  });

  it("the OAuth SUCCESS path (?code=…) is NOT consumed as an error", async () => {
    window.history.replaceState(null, "", "/?code=auth-code-from-supabase");
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.state).toBe("unauthenticated"));
    expect(result.current.error).toBeNull();
    expect(window.location.search).toContain("code=auth-code-from-supabase");
  });
});

describe("AUTH-401 — the error class is mapped and localized (AUTH-200 pattern)", () => {
  it("the auth-provider consumes the redirect and sets the stable codes", () => {
    const text = readFileSync(join(SRC, "app/providers/auth-provider.tsx"), "utf8");
    // The detection pattern covers the live error_description (verified
    // 2026-10-13: "Unable to exchange external code: 4/0A…").
    expect(text).toMatch(/unable to exchange external code/i);
    expect(text).toContain('"oauth_exchange_failed"');
    expect(text).toContain('"oauth_failed"');
    // The consumed params are cleaned off the URL (no re-trigger on refresh).
    expect(text).toContain("history.replaceState");
  });

  it("the login screen maps both codes to translated messages (raw errors pass through)", () => {
    const text = readFileSync(join(SRC, "features/auth/login-screen.tsx"), "utf8");
    expect(text).toContain('error === "provider_disabled"');
    expect(text).toContain('t("auth.signin.providerDisabled")');
    expect(text).toContain('error === "oauth_exchange_failed"');
    expect(text).toContain('t("auth.signin.oauthExchangeFailed")');
    expect(text).toContain('error === "oauth_failed"');
    expect(text).toContain('t("auth.signin.oauthFailed")');
  });

  it("the dictionary carries both messages in EVERY locale (fr/ar/en)", () => {
    for (const locale of LOCALES) {
      const exchangeMsg = translate(locale, "auth.signin.oauthExchangeFailed");
      const genericMsg = translate(locale, "auth.signin.oauthFailed");
      expect(exchangeMsg).not.toBe("auth.signin.oauthExchangeFailed");
      expect(exchangeMsg.length).toBeGreaterThan(20);
      expect(genericMsg).not.toBe("auth.signin.oauthFailed");
      expect(genericMsg.length).toBeGreaterThan(20);
    }
    // The French messages must name the administration (the actionable ask).
    expect(translate("fr", "auth.signin.oauthExchangeFailed")).toContain("administration");
    expect(translate("fr", "auth.signin.oauthFailed")).toContain("administration");
  });
});
