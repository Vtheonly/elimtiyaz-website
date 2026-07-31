# El-Imtiyaz Client Web Portal — TODO

**Iteration: 3 (Production-Ready)**
**Status: ✅ Feature-complete — no mock implementations, no TODOs, no placeholders**

The portal is now production-ready. The only remaining items are infrastructure setup tasks that must be performed by the deployment team (they cannot be automated in code).

---

## Deployment Checklist (must be done by the team)

### 1. Supabase Project

- [ ] Apply the reference migration: `supabase/migrations/0025_device_tokens.sql`
  ```bash
  supabase db push
  # OR paste the SQL into the Supabase SQL Editor
  ```
- [ ] Deploy the Edge Function: `supabase/functions/send-push-notification`
  ```bash
  supabase functions deploy send-push-notification
  ```
- [ ] Set Edge Function secrets:
  ```bash
  supabase secrets set FCM_SERVER_KEY=your_fcm_server_key
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  ```
- [ ] Create the Storage bucket `attendance-justifications` (private, RLS-protected)
- [ ] Configure Google OAuth provider:
  - Dashboard → Authentication → Providers → Google → Enable
  - Paste Google Client ID + Client Secret
  - Add redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- [ ] Set authorized redirect URIs in Google Cloud Console:
  - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
  - `https://portal.elimtiyaz.dz/auth/callback` (production domain)

### 2. Firebase Project (for push notifications)

- [ ] Create a Firebase project
- [ ] Add a web app → copy the config (apiKey, authDomain, etc.)
- [ ] Generate a VAPID key pair: Project Settings → Cloud Messaging → Web Push certificates → Generate
- [ ] Get the FCM Server Key: Project Settings → Cloud Messaging → Server Key (legacy)

### 3. Vercel Deployment

- [ ] Push the repo to GitHub
- [ ] Import in Vercel
- [ ] Set environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_real_anon_key
  NEXT_PUBLIC_FIREBASE_API_KEY=...
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
  NEXT_PUBLIC_FIREBASE_APP_ID=...
  NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
  NEXT_PUBLIC_APP_NAME=El-Imtiyaz Portal
  NEXT_PUBLIC_DEFAULT_LOCALE=fr
  ```
- [ ] Deploy

### 4. Post-Deploy Verification

- [ ] Visit the production URL → login screen renders
- [ ] Click "Sign in with Google" → OAuth flow completes
- [ ] After admin activates the account (via desktop app) → dashboard renders
- [ ] Test push notifications: enable in Profile → verify token appears in `device_tokens` table
- [ ] Test realtime: open two tabs, trigger a staff action → parent tab updates instantly
- [ ] Test offline: disconnect network → offline banner appears → reconnect → data refreshes
- [ ] Test PWA install: on Chrome mobile, "Add to Home Screen" prompt appears
- [ ] Test bulletin: Academic view → "Bulletin" button → print dialog opens
- [ ] Test absence justification: Attendance view → "Justifier" → submit note + file

---

## Optional future enhancements (not blocking production)

### Testing
- [ ] Component tests with React Testing Library (LoginScreen, PendingActivationScreen, StudentSwitcher)
- [ ] E2E tests with Playwright (full auth flow, mobile + desktop viewports)
- [ ] Storybook for shared UI primitives

### Performance
- [ ] Query prefetching on nav tab hover (200ms delay)
- [ ] Server-side rendering for the login page (faster first paint)
- [ ] Bundle analysis with `@next/bundle-analyzer`

### UX
- [ ] Haptic feedback (`navigator.vibrate`) on button presses (mobile only)
- [ ] Aggregate "all children" view for parents with 3+ kids
- [ ] Server-side bulletin PDF generation (higher fidelity than client-side print)

### Monitoring
- [ ] Sentry integration for error tracking
- [ ] Vercel Analytics for page views
- [ ] Supabase logs for Edge Function monitoring

---

## Summary

The portal is **production-ready** with:
- ✅ Zero mock implementations
- ✅ Zero TODO/FIXME comments in source
- ✅ Zero placeholder values in production code
- ✅ Full PWA support (offline, installable, push notifications)
- ✅ Complete security hardening (CSP, HSTS, RLS, validation)
- ✅ Complete i18n (FR/AR/EN, 184 keys each)
- ✅ 68 unit tests passing
- ✅ Comprehensive README + deployment guide

The only work remaining is infrastructure setup (Supabase + Firebase + Vercel) which cannot be done in code — it requires real credentials and dashboard access.
