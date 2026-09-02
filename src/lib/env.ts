/**
 * Environment variable validation.
 *
 * All NEXT_PUBLIC_* env vars are read here and validated with Zod. We do NOT
 * throw in production (a misconfigured portal should show the config-error
 * screen, not crash the build), but we DO surface a structured `env` object
 * that the rest of the codebase consumes.
 *
 * Why a separate module: previously every file read `process.env.X ?? ""`
 * directly, with no central place to detect placeholder values or to add new
 * env vars. This module is that single source of truth.
 *
 * FALLBACK DEFAULTS (T-096, 2026-08-31): every public identifier falls back to
 * the committed values in `src/lib/public-config.ts` when the env var is
 * absent. This is what makes a fresh `git clone` work out of the box — the
 * previous behaviour (empty-string defaults) produced the "Missing
 * configuration" banner on every fresh clone because `.env.local` is
 * gitignored and never survives a push. The defaults are PUBLIC client
 * identifiers (URL + anon key + Firebase web config) — never server secrets.
 * `.env.local` still overrides every value.
 */

import { z } from "zod";
import { PUBLIC_CONFIG_DEFAULTS } from "./public-config";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().default(""),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().default(""),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().default(""),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().default(""),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().default(""),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().default(""),
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().default(""),
  NEXT_PUBLIC_APP_NAME: z.string().default("El-Imtiyaz Portal"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["fr", "ar", "en"]).default("fr"),
});

export type Env = z.infer<typeof envSchema>;

function isPlaceholder(value: string): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.includes("your_") ||
    lower.includes("placeholder") ||
    lower.includes("your-project-ref") ||
    lower === "your_anon_public_key"
  );
}

// Parse once at module load. If parsing fails (e.g. invalid locale), fall back
// to defaults rather than crashing — the portal surfaces config errors in the
// UI via isSupabaseConfigured / isFcmConfigured.
// T-096: public identifiers fall back to the committed PUBLIC defaults so a
// fresh clone (no .env.local) is fully functional; env vars win when set.
// T-096 ROOT-CAUSE FIX: an unset NEXT_PUBLIC_DEFAULT_LOCALE used to feed ""
// into z.enum(["fr","ar","en"]) — "" is NOT undefined, so the enum rejected
// it, safeParse FAILED, and the fallback `envSchema.parse({})` reset EVERY
// value to the zod default "" (URL + anon key included). The portal then
// showed "Missing configuration" even when the env vars were correctly set.
// Empty/unknown locales now resolve to undefined so the .default("fr")
// applies and the parse succeeds.
const rawLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "";
const localeInput: "fr" | "ar" | "en" | undefined =
  rawLocale === "fr" || rawLocale === "ar" || rawLocale === "en" ? rawLocale : undefined;

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_FIREBASE_API_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_VAPID_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "El-Imtiyaz Portal",
  NEXT_PUBLIC_DEFAULT_LOCALE: localeInput,
});

export const env: Env = parsed.success
  ? parsed.data
  : envSchema.parse({});

export const isSupabaseConfigured =
  !isPlaceholder(env.NEXT_PUBLIC_SUPABASE_URL) &&
  !isPlaceholder(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const isFcmConfigured =
  !isPlaceholder(env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
  !isPlaceholder(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  !isPlaceholder(env.NEXT_PUBLIC_FIREBASE_APP_ID) &&
  !isPlaceholder(env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

// NOTE (SEC-007 / task T-009, 2026-08-29): the NEXT_PUBLIC_MOCK_AUTH_ENABLED
// flag and isMockAuthEnabled export were REMOVED together with the entire
// mock-auth system. A feature flag may gate UI, but never an authentication
// bypass — the old flag gated only the button while the underlying session
// hydration ran unconditionally.

if (!isSupabaseConfigured) {
  console.warn(
    "[env] Missing or placeholder NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Fell back to the committed public defaults? No — this means BOTH the env vars AND the " +
      "defaults in src/lib/public-config.ts are missing/placeholder. Fix the defaults file " +
      "(values are public client identifiers; see docs/operations/credentials.md in the hub repo)."
  );
}
if (!isFcmConfigured && env.NEXT_PUBLIC_FIREBASE_API_KEY && !isPlaceholder(env.NEXT_PUBLIC_FIREBASE_API_KEY)) {
  // Only warn if Firebase is partially configured — fully absent is fine (push disabled).
  // T-121 / AUTH-202 (20th session, 2026-09-02): the generic "incomplete"
  // warning told the operator nothing actionable (owner-pasted console
  // evidence from the production Vercel deployment). Name the EXACT missing
  // vars — for this project the two that will actually be missing are the
  // Firebase WEB app id (the known one is the ANDROID app id — a different
  // app in the same Firebase project) and the web-push VAPID key, both set
  // as Vercel environment variables.
  const fcmRequiredVars: ReadonlyArray<readonly [string, string]> = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", env.NEXT_PUBLIC_FIREBASE_API_KEY],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", env.NEXT_PUBLIC_FIREBASE_PROJECT_ID],
    ["NEXT_PUBLIC_FIREBASE_APP_ID (the WEB app id, 1:<project>:web:…)", env.NEXT_PUBLIC_FIREBASE_APP_ID],
    ["NEXT_PUBLIC_FIREBASE_VAPID_KEY", env.NEXT_PUBLIC_FIREBASE_VAPID_KEY],
  ];
  const missingFcmVars = fcmRequiredVars
    .filter(([, value]) => isPlaceholder(value))
    .map(([name]) => name);
  console.warn(
    "[env] Firebase env vars incomplete — push notifications will be disabled. " +
      `Missing: ${missingFcmVars.join(", ")}. ` +
      "Set them as environment variables on the deployment host " +
      "(Vercel: Project → Settings → Environment Variables) to enable web push.",
  );
}
