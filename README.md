# El-Imtiyaz Client Web Portal

A mobile-first Progressive Web App (PWA) for parents and students of the El-Imtiyaz educational platform. The portal is a **client-facing interface** on top of the existing shared Supabase backend — it does not replace the desktop application and does not duplicate any backend logic.

> **📄 For the full from-scratch deployment guide, see [DEPLOYMENT.md](./DEPLOYMENT.md).** It covers Supabase setup (database, auth, storage, RLS, migrations, Edge Functions), Firebase configuration, Vercel deployment, custom domains, post-deploy verification, troubleshooting, and rollback procedures.

## Overview

The portal gives families self-service visibility into grades, schedules, absences, finances, and school communications without burdening staff with phone calls. It is the **only** client surface — there is no native parent mobile app.

### Platform topology

| Platform | Audience | Auth Method |
|----------|----------|-------------|
| Desktop (Electron) | Staff | Email + Password |
| Android | Staff | Email + Password |
| **Web Portal (this repo)** | Parents & Students | Google OAuth |

### Feature matrix (portal scope)

| Feature | Portal capability |
|---------|------------------|
| Parent-Child CRM | View own children (1 parent → N students) + upload documents |
| Grades | View grades, GPA, subject averages + download bulletin PDF |
| Attendance | View history + submit justifications + track justification status (submitted/accepted/rejected) |
| Homework | View assignments + attachments |
| Calendar | View events + exam timetable + derived payment/homework due dates |
| Payments | View dues, installments, payments, invoices, adjustments, receipts + download PDFs |
| Messages | Staff-parent chat (realtime) |
| Notifications | In-app center with deep-linking + FCM push with per-category opt-in/out |
| Profile | Account info + self-edit contact details + language + theme + push toggle |
| Activation | Path A self-service code entry + Path B admin approval |

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **State**: Zustand (client) + TanStack Query (server)
- **Auth**: Supabase Auth (Google OAuth) + Path-A self-service activation code
- **Realtime**: Supabase Realtime (postgres_changes)
- **Push**: Firebase Cloud Messaging (FCM HTTP v1 with OAuth2 service-account tokens)
- **Validation**: Zod (forms + env vars)
- **Testing**: Vitest + React Testing Library
- **Fonts**: Inter + JetBrains Mono + Noto Sans Arabic

## Quick Start

### Prerequisites

- Node.js 18+ or Bun 1.3+
- A Supabase project with the migrations from the desktop repo applied (0001–0024)
- A Firebase project (for push notifications)

### Installation

```bash
# Install dependencies
bun install

# Copy the env template and fill in your values
cp .env.local.example .env.local
# Edit .env.local with your Supabase + Firebase credentials

# Start the dev server
bun run dev
```

Open `http://localhost:3000` in your browser.

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon public key |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | For push | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | For push | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | For push | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | For push | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | For push | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | For push | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | For push | FCM VAPID public key |
| `NEXT_PUBLIC_APP_NAME` | No | App display name (default: "El-Imtiyaz Portal") |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | No | Default language (default: "fr") |

> ⚠️ All `NEXT_PUBLIC_*` variables are exposed to the browser. NEVER put the Supabase `service_role` key in `.env.local` — it's only used in Edge Functions and is set via `supabase secrets set`. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full secret-management guide.

## Architecture

### Single-page SPA with hash routing

The portal uses a SPA-style view switcher (not Next.js routes) because it's fundamentally a single-screen dashboard. Views are synced to the URL hash (`/#/finance`, `/#/academic`) so users can bookmark, use back/forward, and share links.

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, providers)
│   ├── page.tsx                # Auth state machine
│   ├── globals.css             # Design tokens (dark-first)
│   ├── global-error.tsx        # Root error boundary
│   ├── middleware.ts           # Security headers (CSP, HSTS, etc.)
│   └── providers/              # Auth, Theme, QueryClient
├── features/
│   ├── auth/                   # Login + pending/suspended + activation code entry (Path A)
│   ├── dashboard/              # Home view (KPIs, children, events, restriction banner)
│   ├── academic/               # Grades + bulletin PDF
│   ├── attendance/             # Absences + justification dialog + justification status tracking
│   ├── homework/               # Assignments with attachment download
│   ├── calendar/               # Month grid + exam timetable + derived payment/homework events
│   ├── financial/              # Installments, payments, invoices, adjustments, receipts
│   ├── messages/               # Staff-parent chat (realtime)
│   ├── notifications/          # Notification center with deep-linking
│   ├── profile/                # Account + contact self-edit + notification prefs + student docs
│   ├── students/               # Student switcher
│   └── shared/                 # AppShell, nav, error boundary, PWA, SW update, offline
├── lib/
│   ├── env.ts                  # Zod env validation
│   ├── supabase/               # Browser client
│   ├── types/                  # Database row types (mirror real Supabase schema)
│   ├── hooks/                  # TanStack Query + Realtime + SW + FCM registration
│   ├── i18n/                   # FR/AR/EN dictionary (~252 keys each)
│   ├── store/                  # Zustand app store
│   ├── format.ts               # Currency/date formatters
│   ├── validation.ts           # Zod schemas
│   ├── fcm.ts                  # Firebase messaging client
│   └── bulletin.ts             # Printable report card generator
├── test/setup.ts               # Vitest + RTL setup
└── public/
    ├── firebase-messaging-sw.js # Service worker v2 (caching + FCM + pushsubscriptionchange + actions)
    ├── offline.html            # Offline fallback page
    ├── manifest.webmanifest    # PWA manifest (id, shortcuts, screenshots, maskable icons)
    ├── icon.svg                # Brand icon (SVG source)
    ├── icon-192.png + icon-512.png + maskable variants
    ├── apple-touch-icon.png
    ├── favicon-16.png + favicon-32.png
    ├── screenshot-mobile.png + screenshot-desktop.png
    └── robots.txt
supabase/
├── migrations/
│   ├── 0025_device_tokens.sql             # FCM device tokens + RLS
│   ├── 0026_attendance_justification_columns.sql  # justification_* columns + status enum
│   ├── 0027_portal_parent_rls_policies.sql        # parent RLS + column-restriction triggers
│   └── 0028_notification_preferences.sql          # per-category notification opt-in/out
└── functions/
    ├── send-push-notification/   # FCM HTTP v1 with OAuth2 + per-category filtering
    └── bind-activation-code/     # Path A self-service activation
scripts/
└── generate-pwa-icons.py         # regenerates all PWA icons + screenshots from the SVG
```

### Authentication flow

1. Parent visits the portal → sees the Google Sign-In screen.
2. Clicks "Sign in with Google" → Supabase Auth OAuth flow.
3. After redirect, the AuthProvider fetches `user_profiles` by `auth_user_id`.
4. If `status === 'active'` → load parent + children → show dashboard.
5. If `status === 'pending'` → show the activation screen with two options:
   - **Path A:** Tap "J'ai un code d'activation" → enter the 6–7 digit code the school issued → calls the `bind-activation-code` Edge Function → account activates.
   - **Path B:** Wait for the desktop admin to approve the `account_approval_request` → tap "Actualiser".
6. If `status === 'suspended'` → show "account suspended" screen.
7. If `status === 'deleted'` → show "access denied" screen.

The portal does NOT implement registration, invitations, or admin-side activation — those are desktop-only workflows.

### Realtime subscriptions

The portal subscribes to Supabase Realtime `postgres_changes` events on:
- `notifications` (filtered by `target_user_id`)
- `chat_messages` (filtered by `channel_id`)
- `installments` + `payments` (filtered by `parent_id`)
- `homework_assignments` (filtered by `target_class_id`)

When a change is detected, the corresponding TanStack Query cache is invalidated, triggering an instant refetch.

### PWA features

- **Service worker v2** (`public/firebase-messaging-sw.js`):
  - Precaches the app shell on install (HTML, JS, CSS, fonts, icons)
  - Stale-while-revalidate for static assets
  - Cache-first with 24h TTL for images
  - Network-first for navigation with offline fallback
  - Background push notification handler with action buttons (Ouvrir / Ignorer)
  - `pushsubscriptionchange` handler — notifies pages to refresh FCM tokens
  - Background sync retry for queued chat messages
  - Deep-link URL generation from `link_entity_type` (mirrors the in-app mapping)
- **Offline page** (`public/offline.html`): shown when navigation fails and no cache is available
- **Install prompt**: `PwaInstallPrompt` component shows an "Add to Home Screen" banner
- **Update banner**: `SwUpdateBanner` shows when a new service worker version is available
- **Manifest**: includes `id`, `scope`, `display_override`, `shortcuts` (4 quick-actions), `screenshots` (mobile + desktop), maskable icons, `edge_side_panel`

### Security

- **CSP**: strict Content-Security-Policy via middleware (no `unsafe-eval`, limited `unsafe-inline` for styles only)
- **HSTS**: enabled in production (`max-age=31536000; includeSubDomains; preload`)
- **X-Frame-Options**: `DENY` (prevents clickjacking)
- **X-Content-Type-Options**: `nosniff`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: camera, microphone, geolocation all disabled
- **RLS**: all queries are Row-Level-Security protected — parents only see their own data
- **Column-restriction triggers**: parents can self-update only contact fields (phone, email, address, city, postal_code, occupation) on their own `parents` row, and only justification_* columns on `attendance_records`
- **Validation**: Zod schemas validate every form input (justification, chat, file uploads, env vars)
- **File upload limits**: max 10MB, allowed types restricted to PDF/PNG/JPEG/WebP
- **Env validation**: Zod validates all `NEXT_PUBLIC_*` env vars at module load; missing/placeholder values trigger a config-error screen instead of a runtime crash

## Testing

```bash
# Run all unit tests
bun run test

# Watch mode
bun run test:watch

# With coverage report
bun run test:coverage
```

Tests cover:
- `src/lib/format.ts` — currency, date, initials, full name, days-until
- `src/lib/i18n/dictionary.ts` — translation fallback, RTL detection
- `src/lib/validation.ts` — all Zod schemas (justification, chat, file upload)
- `src/features/shared/status-pill.tsx` — payment + attendance tone mappers

**Current status:** 68 tests passing, 0 lint errors, build succeeds.

## Deployment

> **📄 See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete from-scratch deployment guide.** It covers every required component in detail.

### Quick summary

1. **Supabase:** Apply migrations 0025–0028, deploy the 2 Edge Functions, set the Edge Function secrets (including the Firebase service-account JSON for FCM HTTP v1), configure Google OAuth, create the 5 Storage buckets.
2. **Firebase:** Create or reuse a project, add a web app, generate the VAPID key pair + service-account JSON.
3. **Vercel:** Import the GitHub repo, set all `NEXT_PUBLIC_*` env vars, deploy, add a custom domain, update Google OAuth redirect URIs.

### Verify the deployment

After deploy, follow the [Phase 9 — Post-Deployment Verification](./DEPLOYMENT.md#11-phase-9--post-deployment-verification) checklist in DEPLOYMENT.md. It covers auth flow, dashboard, academic, attendance, homework, calendar, financial, messages, notifications, profile, PWA, and security verification.

## Multi-tenancy

The portal respects the existing multi-tenant architecture:
- Every query inherits RLS which filters by `tenant_id` from the user's profile
- The `user_profiles.tenant_id` is set during account creation (by the desktop admin or by the Path-A `bind-activation-code` Edge Function)
- Parents can only see data belonging to their tenant
- Within a tenant, parents can only see their own `parents` row + their own children + their own financial records

## Internationalization

- **French** (default) — primary language
- **Arabic** — full RTL support with Noto Sans Arabic font
- **English** — fallback

Language is persisted in localStorage and switchable from the Profile view. The default language can be overridden via the `NEXT_PUBLIC_DEFAULT_LOCALE` env var (validated to one of `fr` / `ar` / `en`).

## Iteration history

- **Iteration 1:** Initial scaffold + login + dashboard.
- **Iteration 2:** Academic, attendance, financial, calendar, messages, notifications, profile, homework, student switcher.
- **Iteration 3:** Mock removal, Zod validation, security headers, PWA support, i18n completion, unit tests, README.
- **Iteration 4 (current):** Schema-drift fixes (8 tables), 9 missing features (activation code, receipt/adjustment/prefs/doc upload, deep-linking, derived calendar events, justification tracking, is_financially_restricted banner, invigilator name), PWA manifest v2 (PNG icons + shortcuts + screenshots), service worker v2 (pushsubscriptionchange + action buttons + background sync), FCM HTTP v1 migration with OAuth2, dead code removal (31 unused UI primitives + 19 unused npm deps — lockfile 1007 → 601 packages), comprehensive DEPLOYMENT.md guide.

See [DONE.md](./DONE.md) and [TODO.md](./TODO.md) for the full iteration history.

## License

Proprietary — El-Imtiyaz Platform. All rights reserved.
