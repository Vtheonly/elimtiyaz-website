/**
 * Supabase Browser Client
 * ============================================================================
 * Single shared client for the El-Imtiyaz Client Web Portal.
 *
 * IMPORTANT — Source of Truth:
 *   The Supabase backend (database schema, RLS policies, auth config, storage
 *   buckets, edge functions) is ALREADY fully implemented and shared across:
 *     - Desktop application (Electron)
 *     - Android staff app
 *     - This client web portal
 *
 *   This file MUST NOT redefine, replace, or duplicate backend logic.
 *   It is purely a thin client layer that respects the existing schema and RLS.
 *
 *   All queries inherit Row-Level Security automatically — the parent signing
 *   in via Google OAuth will only ever see rows where:
 *     - tenant_id matches their user_profiles.tenant_id, AND
 *     - they are the linked parent (parents.auth_user_id = auth.uid())
 *
 *   See: docs/AUTHENTICATION_SETUP.md and docs/DATABASE_SCHEMA.md in the
 *   desktop repository for the authoritative backend documentation.
 * ============================================================================
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database-schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Detect placeholder values (e.g. "YOUR_PROJECT_REF", "placeholder") so the
 * login screen shows the config-error message instead of trying to connect
 * to a non-existent Supabase project.
 */
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

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
  console.warn(
    "[supabase] Missing or placeholder NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Set real values in .env.local. See README.md."
  );
}

/**
 * Singleton browser client. Safe to call from any client component.
 * Returns null if env vars are not configured — callers should handle this.
 */
export const supabase = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey)
  ? createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

export type SupabaseClient = NonNullable<typeof supabase>;

export const isSupabaseConfigured =
  !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);
