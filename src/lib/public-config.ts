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
 *   - The Supabase URL and public API key are PUBLIC CLIENT IDENTIFIERS.
 *     Supabase's own docs ship them in the browser bundle; access control is
 *     enforced by RLS + JWT verification, not by secrecy. Committing them here
 *     is equivalent to what the browser bundle already contains.
 *   - The Firebase web config values are likewise public (restricted by
 *     Google console rules, not by secrecy).
 *   - The VAPID key (web push) is NOT committed: it is not currently known
 *     and FCM web push therefore stays DISABLED (see isFcmConfigured in
 *     env.ts). Do NOT add server secrets (service_role, sb_secret_…) here —
 *     those must never appear in any client repository.
 *
 * NEW-FORMAT API KEY (T-107 / MIG-KEYS-201, 2026-09-01 — ADR-009):
 *   The committed default below is the project's `sb_publishable_…` key —
 *   the new-format public identifier that Supabase issues alongside (and
 *   intended to replace) the legacy `anon` JWT. supabase-js ^2.111 sends
 *   either format opaquely as the `apikey` header; the backend accepts both.
 *
 * PROJECT CUTOVER (T-516 / CONFIG-500, 2026-10-13):
 *   The committed URL + publishable key were updated from the OLD project
 *   `hkvkefubghbbotgnteir` to the CURRENT live project `vebfehrpzajhstyhinnw`
 *   (live since the 2026-09-17 switch — PR #8 + cc317a6 on the desktop; the
 *   website's defaults were never updated in that cutover, which is exactly
 *   why the freshly-cloned portal hit a dead backend and showed "the site
 *   doesn't work" — root cause recorded in the hub credentials sheet §1 and
 *   §9.1). The previous legacy anon JWT rollback comment was for the OLD
 *   project and is therefore NOT a valid rollback against the new one — it
 *   was REMOVED in this same change. A NEW legacy anon JWT for
 *   `vebfehrpzajhstyhinnw` exists in the Supabase dashboard (Settings → API
 *   Keys, see hub `docs/operations/credentials.md` §9.1) and remains
 *   dual-accepted per ADR-009; agents who need a rollback value must retrieve
 *   it from the dashboard, never from this file.
 *
 * OVERRIDE BEHAVIOUR:
 *   `src/lib/env.ts` reads `process.env.NEXT_PUBLIC_*` FIRST and falls back
 *   to these defaults. `.env.local` (gitignored) can still override every
 *   value — e.g. to point a test build at a different project.
 */

export const PUBLIC_CONFIG_DEFAULTS = {
  // T-516 / CONFIG-500 (2026-10-13): cutover to the current live project
  // `vebfehrpzajhstyhinnw` (live since 2026-09-17). The previous default
  // pointed at the abandoned `hkvkefubghbbotgnteir` project, which broke
  // every fresh clone of the portal.
  NEXT_PUBLIC_SUPABASE_URL: "https://vebfehrpzajhstyhinnw.supabase.co",
  // New-format publishable key (preferred); see the migration note above.
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    "sb_publishable_IPUtQMYQzr1wNnfGTcl5MA_wuz3RUdg",
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
