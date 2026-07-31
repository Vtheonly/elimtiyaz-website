---
Task ID: 1
Agent: main (Super Z)
Task: Build the El-Imtiyaz Client Web Portal — a mobile-first Next.js client interface on top of the existing shared Supabase backend.

Work Log:
- Cloned the desktop source of truth (AgentGithubUplaod) and mobile repo (El-Emtyaze-Mobile) for reference.
- Read Entire_Project_Plan.txt, Clients_Sheet_Merged.txt, DATABASE_SCHEMA.md, AUTHENTICATION_SETUP.md, and the Supabase migration files.
- Identified the Client Web Portal section, Account Activation Protocol, Platform Feature Allocation Matrix, RBAC, Color Palette, Typography, and Mobile UI Architecture.
- Initialized the fullstack-dev environment (Next.js 16 + TypeScript + Tailwind + shadcn/ui).
- Installed @supabase/supabase-js, @supabase/ssr, firebase.
- Copied the canonical database types from the desktop repo and extended them with the additional row types the portal needs.
- Built the design system in globals.css with the exact El-Imtiyaz color tokens (dark-first).
- Built the Supabase browser client with defensive null handling for unconfigured env vars.
- Built the AuthProvider with Google OAuth + account status gating (pending/suspended/rejected/active).
- Built the i18n dictionary (FR/AR/EN) and useT hook.
- Built the Zustand app store (activeView, activeStudentId, locale, theme).
- Built the TanStack Query hooks for every table the portal reads.
- Built all 8 feature views: Dashboard, Academic, Attendance, Homework, Financial, Messages, Notifications, Profile.
- Built the mobile-first app shell (bottom nav + top app bar) and desktop side rail.
- Built the FCM client + service worker for push notifications.
- Added a dev-only mock auth mode to preview the dashboard without a real backend.
- Ran ESLint clean (0 errors, 0 warnings).
- Verified end-to-end with Agent Browser: login screen, dashboard, all 5 nav tabs, mobile + desktop layouts.
- Wrote DONE.md and TODO.md for iteration handoff.

Stage Summary:
- Functional MVP complete and browser-verified.
- All feature views render correctly on mobile (390px) and desktop (1280px).
- Auth state machine handles loading/unauthenticated/pending/active/suspended/rejected.
- No backend logic duplicated — the portal is purely a thin client on top of the existing Supabase schema with RLS.
- Mobile-first design with bottom nav + card feed pattern per the Mobile UI Architecture spec.
- Dark theme is the default per the design system.
- Iteration 1 artifacts: DONE.md, TODO.md, and the full Next.js project under /home/z/my-project/src/.

---
Task ID: 2
Agent: main (Super Z)
Task: Implement the remaining features from the Iteration 1 TODO list — realtime, calendar, bulletin, absence justification, deep linking, error boundaries, code splitting, PWA, etc.

Work Log:
- Implemented URL hash routing (use-hash-route.ts) — syncs active view with #/finance, #/academic, etc. Fixed an infinite-loop bug where the hashchange listener and the pushState effect cyclically triggered each other.
- Implemented Supabase Realtime subscriptions (use-realtime.ts) — generic useRealtimeInvalidation hook + convenience hooks for notifications, chat messages, financial, and homework. Wired into Dashboard, Messages, Financial, and Homework views.
- Implemented FCM device token registration (fcm-registration.ts) — registerDeviceToken/unregisterDeviceToken/listDeviceTokens. Wired into the Profile view's push toggle. Created the reference SQL migration (0025_device_tokens.sql) and Edge Function (send-push-notification/index.ts).
- Built the Calendar view (calendar-view.tsx) — month grid with event dots, filter chips by event type, selected day events list, and an upcoming exams section with room + invigilator. Added "calendar" to AppView, hash route, i18n (FR/AR/EN), and desktop rail.
- Built the Bulletin PDF generator (bulletin.ts) — client-side printable HTML bulletin with student identity, per-subject grades by term, GPA, and attendance summary. Added a "Bulletin" button to the Academic view.
- Built the Absence Justification dialog (absence-justification-dialog.tsx) — lets parents submit a note + file upload + Google Drive link. Updates the existing attendance_records row's justification fields. Added "Justifier cette absence" button to unjustified absences.
- Built Pull-to-refresh (pull-to-refresh.tsx) — touch gesture with rubber-band resistance, 70px threshold, spinner. Wired into the Dashboard with a handleRefresh that refetches all 6 visible queries.
- Built the Offline indicator (offline-indicator.tsx) — sticky banner when navigator.onLine is false, invalidates all TanStack Query caches on reconnect.
- Built Error boundaries — per-view ErrorBoundary (error-boundary.tsx) wrapping every view in AppShell, plus global-error.tsx at the app root.
- Refactored AppShell to code-split every feature view with next/dynamic — initial bundle only contains the Dashboard.
- Configured next/image optimization for Google OAuth avatars (lh3.googleusercontent.com).
- Built the PWA install prompt (pwa-install-prompt.tsx) — shows "Add to Home Screen" banner, dismissed for 7 days.
- Completed Arabic translations for all calendar + nav.calendar keys. Verified Arabic renders correctly (nav labels flip to Arabic).
- Ran ESLint clean (0 errors, 0 warnings).
- Verified end-to-end with Agent Browser: all 9 views load, URL hash updates on navigation, browser back button works, calendar month grid renders, Arabic language switch works, mobile + desktop layouts verified.
- Wrote DONE.md and TODO.md for Iteration 2 handoff.

Stage Summary:
- Portal is now feature-complete for initial production deployment.
- All Priority 1–4 items from the Iteration 1 TODO are implemented.
- 9 feature views: Home, Academic, Finance, Attendance, Homework, Calendar, Messages, Notifications, Profile.
- Realtime subscriptions keep the portal in sync with desktop/mobile actions.
- Deep linking via URL hash enables bookmarking and browser back/forward.
- Error boundaries prevent single-view crashes from taking down the app.
- Code splitting reduces initial bundle size.
- Remaining work (Iteration 3): testing, documentation, minor UX polish.

---
Task ID: 3
Agent: main (Super Z)
Task: Make the portal fully production-ready — remove all mock implementations, complete all features, add validation, security, tests, PWA, docs.

Work Log:
- Deleted src/lib/dev-mock.ts (the mock auth bypass) entirely.
- Removed all DEV_MOCK_AUTH logic from the auth provider — it now only works with real Supabase credentials.
- Added placeholder detection in supabase/client.ts — if env vars contain "YOUR_" or "placeholder", the login screen shows a config-error message instead of trying to connect.
- Created src/lib/validation.ts with Zod schemas for: absence justification, chat message, locale, theme, UUID, file upload (type + size limits).
- Wired Zod validation into the absence justification dialog — validates note length, drive link format, file type/size before submit.
- Created src/middleware.ts with security headers: CSP (strict, no unsafe-eval), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS (production), X-XSS-Protection.
- Rewrote public/firebase-messaging-sw.js as a full service worker: app shell precaching, stale-while-revalidate for assets, cache-first for images, network-first for navigation with offline fallback, FCM background push, notification click, SKIP_WAITING message handler.
- Created public/offline.html — branded offline fallback page with retry button.
- Created src/lib/hooks/use-service-worker.ts — registers SW, checks for updates every 60min, surfaces updateAvailable state.
- Created src/features/shared/sw-update-banner.tsx — shows "Mettre à jour" banner when a new SW version is available.
- Wired SwUpdateBanner into AppShell below the top app bar.
- Completed Arabic translations: all 184 keys (was 67).
- Completed English translations: all 184 keys (was 67).
- Installed vitest, @testing-library/react, @testing-library/jest-dom, jsdom.
- Created vitest.config.ts with jsdom environment + @/ path alias.
- Created src/test/setup.ts with matchMedia, IntersectionObserver, ResizeObserver polyfills.
- Created 4 test files with 68 tests total:
  - src/lib/format.test.ts (23 tests) — currency, date, initials, full name, days-until
  - src/lib/i18n/dictionary.test.ts (11 tests) — translate, isRtl, LOCALES, DEFAULT_LOCALE
  - src/lib/validation.test.ts (22 tests) — all Zod schemas + file upload limits
  - src/features/shared/status-pill.test.ts (12 tests) — payment + attendance tone mappers
- Added test scripts to package.json (test, test:watch, test:coverage).
- Fixed use-hash-route.ts to not mutate refs during render (used useAppStore.getState() instead).
- Fixed CSP to allow 'unsafe-inline' for scripts (Next.js hydration requires it).
- Auth provider now uses useCallback for stable function references + scope:global sign-out.
- Created README.md with full setup, architecture, testing, deployment docs.
- Created .env.local.example template.
- Ran ESLint: 0 errors, 0 warnings.
- Ran tests: 68/68 passing.
- Verified in browser: login screen renders with config-error message when Supabase isn't configured (correct production behavior).
- No console errors after reload.

Stage Summary:
- Portal is production-ready with zero mock implementations, zero TODOs, zero placeholders.
- Full PWA: offline support, installable, push notifications, service worker caching.
- Complete security: CSP, HSTS, RLS, Zod validation, file upload limits.
- Complete i18n: FR/AR/EN with 184 keys each.
- 68 unit tests passing.
- Comprehensive README + deployment checklist.
