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
 */

import { z } from "zod";

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
const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "",
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "",
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "",
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

if (!isSupabaseConfigured) {
  console.warn(
    "[env] Missing or placeholder NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Set real values in .env.local. See README.md."
  );
}
if (!isFcmConfigured && env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  // Only warn if Firebase is partially configured — fully absent is fine (push disabled).
  console.warn(
    "[env] Firebase env vars are incomplete. Push notifications will be disabled."
  );
}
