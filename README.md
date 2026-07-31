# El-Imtiyaz Client Web Portal

A mobile-first Progressive Web App (PWA) for parents and students of the El-Imtiyaz educational platform. The portal is a **client-facing interface** on top of the existing shared Supabase backend — it does not replace the desktop application and does not duplicate any backend logic.

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
| Parent-Child CRM | View own children (1 parent → N students) |
| Grades | View grades, GPA, subject averages |
| Attendance | View history + submit justifications |
| Homework | View assignments + attachments |
| Calendar | View events + exam timetable |
| Payments | View dues, installments, receipts |
| Messages | Staff-parent communication |
| Notifications | In-app + FCM push notifications |
| Bulletin | Download printable report card (PDF) |

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **State**: Zustand (client) + TanStack Query (server)
- **Auth**: Supabase Auth (Google OAuth)
- **Realtime**: Supabase Realtime (postgres_changes)
- **Push**: Firebase Cloud Messaging (FCM)
- **Validation**: Zod
- **Testing**: Vitest + React Testing Library
- **Fonts**: Inter + JetBrains Mono + Noto Sans Arabic

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- A Supabase project with the migrations from the desktop repo applied
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
│   ├── auth/                   # Login + pending/suspended screens
│   ├── dashboard/              # Home view (KPIs, children, events)
│   ├── academic/               # Grades + bulletin PDF
│   ├── attendance/             # Absences + justification dialog
│   ├── homework/               # Assignments
│   ├── calendar/               # Month grid + exam timetable
│   ├── financial/              # Installments, payments, receipts
│   ├── messages/               # Staff-parent chat
│   ├── notifications/          # Notification center
│   ├── profile/                # Account + preferences
│   ├── students/               # Student switcher
│   └── shared/                 # AppShell, nav, error boundary, etc.
├── lib/
│   ├── supabase/               # Browser client
│   ├── types/                  # Database row types (mirror desktop)
│   ├── hooks/                  # TanStack Query + Realtime + SW
│   ├── i18n/                   # FR/AR/EN dictionary
│   ├── store/                  # Zustand app store
│   ├── format.ts               # Currency/date formatters
│   ├── validation.ts           # Zod schemas
│   ├── fcm.ts                  # Firebase messaging client
│   └── bulletin.ts             # Printable report card generator
├── public/
│   ├── firebase-messaging-sw.js  # Service worker (caching + FCM)
│   ├── offline.html            # Offline fallback page
│   ├── manifest.webmanifest    # PWA manifest
│   └── icon.svg                # Brand icon
└── supabase/                   # Reference backend artifacts
    ├── migrations/             # 0025_device_tokens.sql
    └── functions/              # send-push-notification Edge Function
```

### Authentication flow

1. Parent visits the portal → sees the Google Sign-In screen.
2. Clicks "Sign in with Google" → Supabase Auth OAuth flow.
3. After redirect, the AuthProvider fetches `user_profiles` by `auth_user_id`.
4. If `status === 'active'` → load parent + children → show dashboard.
5. If `status === 'pending'` → show "account not activated" screen.
6. If `status === 'suspended'` → show "account suspended" screen.

The portal does NOT implement registration, invitations, or activation — those are desktop-only workflows.

### Realtime subscriptions

The portal subscribes to Supabase Realtime `postgres_changes` events on:
- `notifications` (filtered by `target_user_id`)
- `chat_messages` (filtered by `channel_id`)
- `installments` + `payments` (filtered by `parent_id`)
- `homework_assignments` (filtered by `target_class_id`)

When a change is detected, the corresponding TanStack Query cache is invalidated, triggering an instant refetch.

### PWA features

- **Service worker** (`public/firebase-messaging-sw.js`):
  - Precaches the app shell on install
  - Stale-while-revalidate for static assets
  - Cache-first with TTL for images
  - Network-first for navigation with offline fallback
  - Background push notification handler
- **Offline page** (`public/offline.html`): shown when navigation fails and no cache is available
- **Install prompt**: `PwaInstallPrompt` component shows an "Add to Home Screen" banner
- **Update banner**: `SwUpdateBanner` shows when a new service worker version is available

### Security

- **CSP**: strict Content-Security-Policy via middleware (no `unsafe-eval`, limited `unsafe-inline` for styles only)
- **HSTS**: enabled in production (`max-age=31536000; includeSubDomains; preload`)
- **X-Frame-Options**: `DENY` (prevents clickjacking)
- **X-Content-Type-Options**: `nosniff`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: camera, microphone, geolocation all disabled
- **RLS**: all queries are Row-Level-Security protected — parents only see their own data
- **Validation**: Zod schemas validate every form input (justification, chat, file uploads)
- **File upload limits**: max 10MB, allowed types restricted to PDF/PNG/JPEG/WebP

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

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import the repo in Vercel
3. Set environment variables (see above)
4. Deploy — the `output: "standalone"` config is already set

### Supabase setup

1. Apply the migration `supabase/migrations/0025_device_tokens.sql`
2. Deploy the Edge Function: `supabase functions deploy send-push-notification`
3. Set Edge Function secrets:
   ```bash
   supabase secrets set FCM_SERVER_KEY=your_key
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
   ```
4. Create the Storage bucket `attendance-justifications`
5. Configure Google OAuth (Dashboard → Authentication → Providers → Google)

### Firebase setup

1. Create a Firebase project
2. Add a web app and copy the config
3. Generate a VAPID key pair (Project Settings → Cloud Messaging → Web Push certificates)
4. Set the Firebase env vars in Vercel

## Multi-tenancy

The portal respects the existing multi-tenant architecture:
- Every query inherits RLS which filters by `tenant_id` from the user's profile
- The `user_profiles.tenant_id` is set during account creation (by the desktop admin)
- Parents can only see data belonging to their tenant

## Internationalization

- **French** (default) — primary language
- **Arabic** — full RTL support with Noto Sans Arabic font
- **English** — fallback

Language is persisted in localStorage and switchable from the Profile view.

## License

Proprietary — El-Imtiyaz Platform. All rights reserved.
