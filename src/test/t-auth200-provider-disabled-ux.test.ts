/**
 * AUTH-200 — provider-disabled UX regression suite (19th session, 2026-09-02).
 *
 * Problem: with the Google OAuth provider DISABLED server-side (the live
 * project state, re-verified 2026-09-02 via the Management API:
 * external_google_enabled=false, client_id/secret EMPTY), a parent clicking
 * "Se connecter avec Google" got the RAW English server error
 * ("Unsupported provider: provider is not enabled") in the red error box —
 * meaningless to a parent and indistinguishable from a client bug.
 *
 * Fixed: the auth-provider maps that error class to the stable code
 * "provider_disabled"; the login screen renders a localized, actionable
 * message (contact the school administration) for that code; raw errors
 * still pass through verbatim for every other failure class.
 *
 * The OWNER-side fix (create the Google OAuth client + enable the provider —
 * ~10 minutes in the Google Console + one PATCH) is documented in the hub
 * runbook: docs/operations/portal-google-oauth.md. This test pins the
 * client-side half so the UX stays correct before AND after the provider is
 * enabled.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { translate, LOCALES } from "@/lib/i18n/dictionary";

const SRC = join(__dirname, "..");

describe("AUTH-200 — the provider-disabled error class is mapped and localized", () => {
  it("the auth-provider sets the stable code for the disabled-provider error class", () => {
    const text = readFileSync(join(SRC, "app/providers/auth-provider.tsx"), "utf8");
    // The detection pattern covers the live server message (verified
    // 2026-09-02: "Unsupported provider: provider is not enabled").
    expect(text).toMatch(/unsupported provider\|provider is not enabled/i);
    expect(text).toContain('setError(providerDisabled ? "provider_disabled" : oauthErr.message)');
    // The raw error still flows through for every other failure class.
    expect(text).toContain("oauthErr.message");
  });

  it("the login screen maps the code to the translated message (raw errors pass through)", () => {
    const text = readFileSync(join(SRC, "features/auth/login-screen.tsx"), "utf8");
    expect(text).toContain('error === "provider_disabled"');
    expect(text).toContain('t("auth.signin.providerDisabled")');
  });

  it("the dictionary carries the message in EVERY locale (fr/ar/en)", () => {
    for (const locale of LOCALES) {
      const msg = translate(locale, "auth.signin.providerDisabled");
      expect(msg).not.toBe("auth.signin.providerDisabled");
      expect(msg.length).toBeGreaterThan(20);
    }
    // The French message must name the administration (the actionable ask).
    expect(translate("fr", "auth.signin.providerDisabled")).toContain("administration");
  });

  it("no other surface renders the raw error unchanged for this code (only the login screen)", () => {
    const text = readFileSync(join(SRC, "app/providers/auth-provider.tsx"), "utf8");
    // The code is assigned ONLY inside the provider-disabled branch of
    // signInWithGoogle (the ternary); every other setError call site passes a
    // genuine message string.
    expect(text.match(/setError\(providerDisabled \? "provider_disabled"/g)?.length ?? 0).toBe(1);
  });
});
