/**
 * T-096 regression tests — out-of-the-box portal configuration.
 *
 * The defect: a fresh `git clone` of elimtiyaz-website showed the
 * "Missing configuration" screen (French: "Configuration manquante")
 * because the Supabase URL + anon key lived ONLY in `.env.local`, which is
 * gitignored and never survives a clone/push cycle. The owner hit this twice
 * (sessions 13 and 14): each time an agent created `.env.local` on the build
 * machine, zipped the repo, the owner pushed to GitHub, re-cloned — and the
 * banner was back.
 *
 * The fix: public client identifiers are committed as code-level defaults in
 * `src/lib/public-config.ts` (classified public per
 * docs/operations/credentials.md in the hub repo) and `env.ts` falls back to
 * them when the env vars are absent.
 *
 * These tests pin the three behaviours that must hold:
 *   1. With NO env vars at all (the fresh-clone scenario), the portal is
 *      Supabase-configured — `isSupabaseConfigured === true`.
 *   2. Real env vars still override the committed defaults.
 *   3. The committed defaults contain no server secrets (service_role /
 *      sb_secret / sbp_ access tokens must never appear).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
] as const;

describe("T-096 — out-of-the-box portal configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("fresh clone (no env vars): portal is Supabase-configured — no 'Missing configuration' banner", async () => {
    for (const key of ENV_KEYS) expect(process.env[key]).toBeUndefined();
    const { isSupabaseConfigured, env } = await import("./env");
    // This is exactly what auth-provider exposes as `configured` and what
    // login-screen uses to decide between the config-error banner and the
    // Google sign-in button.
    expect(isSupabaseConfigured).toBe(true);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://hkvkefubghbbotgnteir.supabase.co");
    // T-107 / MIG-KEYS-201 (2026-09-01): the committed default is now the
    // new-format PUBLISHABLE key (ADR-009 — dual acceptance, publishable-
    // preferred). Previously pinned to the legacy JWT shape (/^eyJ/).
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toMatch(/^sb_publishable_[A-Za-z0-9_-]+$/);
  });

  it("fresh clone: FCM web push stays truthfully DISABLED (no web app id / VAPID key known)", async () => {
    const { isFcmConfigured } = await import("./env");
    // The known Firebase app id is the ANDROID one — the WEB app id and the
    // VAPID key were never issued. The flag must stay false (push disabled),
    // never claim a half-configured push pipeline works.
    expect(isFcmConfigured).toBe(false);
  });

  it("real env vars override the committed public defaults", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    const { env, isSupabaseConfigured } = await import("./env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
    expect(isSupabaseConfigured).toBe(true);
  });

  it("placeholder env values are still detected even with defaults present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project-ref.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "your_anon_public_key";
    const { isSupabaseConfigured } = await import("./env");
    expect(isSupabaseConfigured).toBe(false);
  });

  it("committed public defaults contain NO server secrets (SEC guard)", async () => {
    const { PUBLIC_CONFIG_DEFAULTS } = await import("./public-config");
    const serialized = JSON.stringify(PUBLIC_CONFIG_DEFAULTS);
    expect(serialized).not.toMatch(/service_role/i);
    expect(serialized).not.toContain("sb_secret_");
    expect(serialized).not.toContain("sbp_"); // Management-API access token
    expect(serialized).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    // Also scan the committed template for the same leak classes.
    const envExample = readFileSync(
      resolve(process.cwd(), ".env.example"),
      "utf8",
    );
    expect(envExample).not.toContain("sb_secret_");
    expect(envExample).not.toContain("sbp_");
    expect(envExample).not.toMatch(/service_role\s*=/i);
  });
});
