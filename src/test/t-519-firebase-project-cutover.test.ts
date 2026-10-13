/**
 * T-519 / CONFIG-501 regression — website Firebase project cutover.
 *
 * THE DEFECT: the website's committed Firebase web config in
 * `src/lib/public-config.ts` (the T-096 out-of-the-box-config design) still
 * pointed at the OLD `elimtiyaz-android` Firebase project (nr. 259221439109)
 * even though that project never had a WEB app registered (only the Android
 * app was known — the WEB app id was therefore left empty since T-096, and
 * web push could never be enabled). The owner created the NEW Firebase
 * project `elimtiyaz-production` (nr. 944201689219) WITH a real web app and
 * supplied its full public web config (owner mandate, 2026-10-13: "make sure
 * the website reflects these settings correctly").
 *
 * THE FIX (T-519 / CONFIG-501, 2026-10-13): the committed Firebase defaults
 * in `src/lib/public-config.ts` and `.env.example` were cut over to the NEW
 * project — including its real WEB app id. The ONLY intentionally-unset
 * value left is the web-push VAPID key (no Web Push certificate issued for
 * the new project yet), so `isFcmConfigured` stays false (truthful disabled
 * state). NOTE: this Firebase config serves FCM push ONLY — the portal's
 * AUTH goes through Supabase Auth (Google provider), never Firebase Auth.
 *
 * These tests pin the behaviours that must hold:
 *   1. The committed Firebase defaults point at the NEW project (all six
 *      public values pinned, VAPID still empty).
 *   2. A fresh clone resolves the Firebase env to the NEW project and FCM
 *      stays truthfully disabled (VAPID missing).
 *   3. Setting ONLY the VAPID key (env override) flips isFcmConfigured to
 *      true — proving the VAPID key is the sole remaining gap for web push.
 *   4. `.env.example` ships the NEW project's Firebase values.
 *   5. NO old-project Firebase residue (old API key / authDomain / storage
 *      bucket / sender id) remains anywhere in the source tree.
 *
 * Related: hub `docs/operations/credentials.md` §9.6 (the new project's
 * Firebase web config + the VAPID residual) and §9.4 (the Google-console
 * OAuth residuals — the auth chain is Supabase-side, not Firebase-side).
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const NEW_FIREBASE_PROJECT_ID = "elimtiyaz-production";
const NEW_FIREBASE_API_KEY = "AIzaSyByguKxez7hNjkGcdLnbTCHLI5nJzEFqvY";
const NEW_FIREBASE_AUTH_DOMAIN = "elimtiyaz-production.firebaseapp.com";
const NEW_FIREBASE_STORAGE_BUCKET = "elimtiyaz-production.firebasestorage.app";
const NEW_FIREBASE_SENDER_ID = "944201689219";
const NEW_FIREBASE_WEB_APP_ID = "1:944201689219:web:b5fbe39a56e09c7629d3b6";

const OLD_FIREBASE_API_KEY = "AIzaSyAzDjnuF7QMh3jWZAoJYiIxohfAD7Ba3_8";
const OLD_FIREBASE_AUTH_DOMAIN = "elimtiyaz-android.firebaseapp.com";
const OLD_FIREBASE_STORAGE_BUCKET = "elimtiyaz-android.firebasestorage.app";
const OLD_FIREBASE_SENDER_ID = "259221439109";

const FCM_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
] as const;

function readSource(relativePath: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 3; i++) {
    try {
      return readFileSync(path.join(dir, relativePath), "utf8");
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error(`source file not found from ${process.cwd()}: ${relativePath}`);
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx|js|jsx|mjs|json|example|webmanifest)$/.test(entry)) {
      yield full;
    }
  }
}

describe("T-519 / CONFIG-501 — website Firebase project cutover", () => {
  it("committed PUBLIC_CONFIG_DEFAULTS point at the NEW elimtiyaz-production project", async () => {
    const { PUBLIC_CONFIG_DEFAULTS } = await import("../lib/public-config");
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_API_KEY).toBe(NEW_FIREBASE_API_KEY);
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN).toBe(NEW_FIREBASE_AUTH_DOMAIN);
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe(NEW_FIREBASE_PROJECT_ID);
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).toBe(NEW_FIREBASE_STORAGE_BUCKET);
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID).toBe(NEW_FIREBASE_SENDER_ID);
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_APP_ID).toBe(NEW_FIREBASE_WEB_APP_ID);
    // The VAPID key is the ONLY intentionally-unset value (no Web Push
    // certificate issued for the new project yet).
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_VAPID_KEY).toBe("");
  });

  it("fresh clone (no env vars): env.ts resolves to the NEW project and FCM stays truthfully disabled", async () => {
    vi.resetModules();
    for (const key of FCM_ENV_KEYS) delete process.env[key];
    const { env, isFcmConfigured } = await import("../lib/env");
    expect(env.NEXT_PUBLIC_FIREBASE_API_KEY).toBe(NEW_FIREBASE_API_KEY);
    expect(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN).toBe(NEW_FIREBASE_AUTH_DOMAIN);
    expect(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe(NEW_FIREBASE_PROJECT_ID);
    expect(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).toBe(NEW_FIREBASE_STORAGE_BUCKET);
    expect(env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID).toBe(NEW_FIREBASE_SENDER_ID);
    expect(env.NEXT_PUBLIC_FIREBASE_APP_ID).toBe(NEW_FIREBASE_WEB_APP_ID);
    // Truthful disabled state: only the VAPID key is missing now.
    expect(isFcmConfigured).toBe(false);
    for (const key of FCM_ENV_KEYS) delete process.env[key];
  });

  it("setting ONLY the VAPID key flips isFcmConfigured to true — the sole remaining gap for web push", async () => {
    vi.resetModules();
    for (const key of FCM_ENV_KEYS) delete process.env[key];
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = "BP_the_owner_supplied_web_push_certificate";
    try {
      const { env, isFcmConfigured } = await import("../lib/env");
      expect(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe(NEW_FIREBASE_PROJECT_ID);
      expect(isFcmConfigured).toBe(true);
    } finally {
      delete process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      for (const key of FCM_ENV_KEYS) delete process.env[key];
    }
  });

  it(".env.example ships the NEW project's Firebase web config", () => {
    const envExample = readSource(".env.example");
    expect(envExample).toContain(`NEXT_PUBLIC_FIREBASE_API_KEY=${NEW_FIREBASE_API_KEY}`);
    expect(envExample).toContain(`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEW_FIREBASE_AUTH_DOMAIN}`);
    expect(envExample).toContain(`NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEW_FIREBASE_PROJECT_ID}`);
    expect(envExample).toContain(`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEW_FIREBASE_STORAGE_BUCKET}`);
    expect(envExample).toContain(`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEW_FIREBASE_SENDER_ID}`);
    expect(envExample).toContain(`NEXT_PUBLIC_FIREBASE_APP_ID=${NEW_FIREBASE_WEB_APP_ID}`);
  });

  it("NO old-project Firebase residue (API key / authDomain / storage bucket / sender id) remains in the source tree", () => {
    // The cutover must be complete — a stale value in any non-documentation
    // file means a code path is still configured against the old project.
    // The bare project NAME "elimtiyaz-android" may legitimately appear as a
    // historical anchor in documentation comments; the four strings scanned
    // here are the actionable config values.
    const offenders: string[] = [];
    for (const file of walk(path.join(process.cwd()))) {
      // Exclude this scan's own detection list (the old values appear here
      // as the scan targets — the T-001 self-exclusion technique).
      if (file.endsWith("t-519-firebase-project-cutover.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      const hits: string[] = [];
      if (text.includes(OLD_FIREBASE_API_KEY)) hits.push("old API key");
      if (text.includes(OLD_FIREBASE_AUTH_DOMAIN)) hits.push("old authDomain");
      if (text.includes(OLD_FIREBASE_STORAGE_BUCKET)) hits.push("old storage bucket");
      if (text.includes(OLD_FIREBASE_SENDER_ID)) hits.push("old sender id");
      if (hits.length > 0) {
        offenders.push(path.relative(process.cwd(), file) + " [" + hits.join(", ") + "]");
      }
    }
    expect(offenders).toEqual(
      [],
      `Stale OLD-project Firebase values found in: ${offenders.join("; ")}. ` +
        "T-519 cut the website over to elimtiyaz-production; do not " +
        "reintroduce the old project's config.",
    );
  });
});
