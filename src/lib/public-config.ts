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
 * FIREBASE PROJECT CUTOVER (T-519 / CONFIG-501, 2026-10-13):
 *   The owner created the NEW Firebase project `elimtiyaz-production`
 *   (nr. 944201689219) with a real WEB app and supplied its full public web
 *   config. The committed Firebase defaults were cut over from the OLD
 *   `elimtiyaz-android` project (which never had a web app registered — only
 *   the Android app was known, so the WEB app id was left empty since T-096).
 *   The WEB app id is now KNOWN and COMMITTED; the ONLY remaining empty value
 *   is the web-push VAPID key (the owner must generate a Web Push certificate
 *   in the new Firebase console → Project settings → Cloud Messaging).
 *   isFcmConfigured therefore still returns false (push disabled, truthful)
 *   until that key arrives. NOTE: this Firebase config serves FCM push ONLY —
 *   the portal's AUTH goes through Supabase Auth (Google provider), never
 *   Firebase Auth; the auth-chain consequence of the new project is that the
 *   owner will register the OAuth client on the new project's Google Cloud
 *   Console (owner-gated, see hub `docs/operations/portal-google-oauth.md`).
 *   The `measurementId` (G-G3YGN1WZF3) is Analytics-only; the portal imports
 *   no firebase/analytics, so it is recorded in the hub credentials sheet
 *   §9.6 but intentionally NOT wired here (no dead config slots).
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
  // Firebase web (FCM) — public web config for project elimtiyaz-production.
  // T-519 / CONFIG-501 (2026-10-13): cutover from the OLD `elimtiyaz-android`
  // project (which had NO web app registered — the known app id was the
  // ANDROID one, so the WEB app id stayed empty since T-096) to the owner's
  // NEW `elimtiyaz-production` project, whose WEB app id is now known and
  // committed below. The ONLY intentionally-unset value left is the web-push
  // VAPID key (never issued for the new project) — isFcmConfigured therefore
  // stays FALSE (push disabled) until the owner generates the Web Push
  // certificate in the Firebase console — a truthful state, not a broken one.
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyByguKxez7hNjkGcdLnbTCHLI5nJzEFqvY",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "elimtiyaz-production.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "elimtiyaz-production",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "elimtiyaz-production.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "944201689219",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:944201689219:web:b5fbe39a56e09c7629d3b6",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: "",
} as const;
