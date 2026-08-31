/**
 * Committed PUBLIC configuration defaults for the El-Imtiyaz parent portal.
 *
 * WHY THIS FILE EXISTS (T-096, 2026-08-31 — owner-requested):
 *   The portal used to show "Missing configuration" on a fresh clone because
 *   the Supabase URL + anon key lived only in `.env.local` — which is
 *   gitignored (correctly) and therefore never survived a clone/push cycle.
 *   The 13th repair session configured `.env.local` on the build machine and
 *   zipped the repos, but once the owner pushed to GitHub and re-cloned, the
 *   banner came back. The durable fix is to commit the values that are
 *   public BY DESIGN as code-level defaults.
 *
 * SECURITY CLASSIFICATION (docs/operations/credentials.md, hub repo):
 *   - The Supabase URL and anon key are PUBLIC CLIENT IDENTIFIERS. Supabase's
 *     own docs ship them in the browser bundle; access control is enforced by
 *     RLS + JWT verification, not by secrecy. Committing them here is
 *     equivalent to what the browser bundle already contains.
 *   - The Firebase web config values are likewise public (restricted by
 *     Google console rules, not by secrecy).
 *   - The VAPID key (web push) is NOT committed: it is not currently known
 *     and FCM web push therefore stays DISABLED (see isFcmConfigured in
 *     env.ts). Do NOT add server secrets (service_role, sb_secret_…) here —
 *     those must never appear in any client repository.
 *
 * OVERRIDE BEHAVIOUR:
 *   `src/lib/env.ts` reads `process.env.NEXT_PUBLIC_*` FIRST and falls back
 *   to these defaults. `.env.local` (gitignored) can still override every
 *   value — e.g. to point a test build at a different project.
 */

export const PUBLIC_CONFIG_DEFAULTS = {
  NEXT_PUBLIC_SUPABASE_URL: "https://hkvkefubghbbotgnteir.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrdmtlZnViZ2hiYm90Z250ZWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDQ2ODQsImV4cCI6MjEwMDU4MDY4NH0.GDQiKjp4YBbCpsgoJXeSUqUT8Ag67He2fmngy6NNPmk",
  // Firebase web (FCM) — public web config for project elimtiyaz-android.
  // NOTE: the Firebase *web* app id and the VAPID key are intentionally left
  // unset: the app id known today is the ANDROID app id (a different app in
  // the same Firebase project) and the web push VAPID key has never been
  // issued. isFcmConfigured therefore stays FALSE (push disabled) until the
  // owner supplies the real web values — a truthful state, not a broken one.
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAzDjnuF7QMh3jWZAoJYiIxohfAD7Ba3_8",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "elimtiyaz-android.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "elimtiyaz-android",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "elimtiyaz-android.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "259221439109",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: "",
} as const;
