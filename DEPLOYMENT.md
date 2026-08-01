# El-Imtiyaz Client Web Portal — Complete Deployment Guide

**Version:** Iteration 4 (2026-08-01)
**Status:** Production-ready PWA
**Stack:** Next.js 16 · Supabase · Firebase Cloud Messaging · Vercel

This guide walks you through deploying the entire portal from scratch. The portal is a **client interface layer** that sits on top of the existing shared Supabase backend (already used by the desktop Electron app and the staff Android app). You do NOT need to re-implement the backend — only apply the 4 reference SQL migrations and deploy the 2 Edge Functions that the portal needs.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Phase 1 — Supabase Project Setup](#3-phase-1--supabase-project-setup)
4. [Phase 2 — Database Migrations](#4-phase-2--database-migrations)
5. [Phase 3 — Authentication Configuration](#5-phase-3--authentication-configuration)
6. [Phase 4 — Storage Buckets](#6-phase-4--storage-buckets)
7. [Phase 5 — Edge Functions](#7-phase-5--edge-functions)
8. [Phase 6 — Firebase Project (Push Notifications)](#8-phase-6--firebase-project-push-notifications)
9. [Phase 7 — Local Development Setup](#9-phase-7--local-development-setup)
10. [Phase 8 — Vercel Deployment](#10-phase-8--vercel-deployment)
11. [Phase 9 — Post-Deployment Verification](#11-phase-9--post-deployment-verification)
12. [Phase 10 — Custom Domain + Production Hardening](#12-phase-10--custom-domain--production-hardening)
13. [Troubleshooting](#13-troubleshooting)
14. [Rollback Procedure](#14-rollback-procedure)
15. [Reference: All Environment Variables](#15-reference-all-environment-variables)

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                      SHARED SUPABASE BACKEND                    │
│  (one project — used by Desktop App + Android App + Web Portal) │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │  Postgres   │  │  Auth       │  │  Storage               │  │
│  │  + RLS      │  │  (Google    │  │  (attendance-          │  │
│  │  + 28       │  │   OAuth)    │  │   justifications,      │  │
│  │  migrations │  │             │  │   student-documents,   │  │
│  │             │  │             │  │   receipts,            │  │
│  │             │  │             │  │   payment-proofs,      │  │
│  │             │  │             │  │   homework-attachments) │  │
│  └─────────────┘  └─────────────┘  └────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Edge Functions (Deno)                                   │  │
│  │  ├── send-push-notification (FCM HTTP v1 fan-out)        │  │
│  │  └── bind-activation-code (Path A self-service)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS (anon key + JWT)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────────┐
│  Desktop App  │    │  Android App  │    │   Web Portal      │
│  (Electron)   │    │  (Staff)      │    │   (Next.js PWA)   │
│  — Admin      │    │  — Staff      │    │   — Parents +     │
│    terminal   │    │    field ops  │    │     Students      │
└───────────────┘    └───────────────┘    └───────────────────┘
                                                  │
                                                  │ FCM Web Push
                                                  ▼
                                          ┌───────────────┐
                                          │   Firebase    │
                                          │   Project     │
                                          └───────────────┘
```

**Key principle:** The web portal is **only a client interface layer**. It does NOT:
- Re-implement any business logic that already lives in the desktop app or Supabase.
- Bypass Row-Level Security (RLS). Every query inherits the signed-in parent's tenant + identity automatically.
- Provision accounts. Account activation is performed by the desktop admin OR via the Path-A self-service activation code (the school issues the code from the desktop app, the parent enters it on the web).

---

## 2. Prerequisites

Before you begin, you need:

| Requirement | Why | How to get it |
|-------------|-----|---------------|
| A Supabase project (existing or new) | The shared backend | https://supabase.com → New Project |
| The desktop app repo (`AgentGithubUplaod`) | Source of truth for the existing 24 migrations | https://github.com/Vtheonly/AgentGithubUplaod |
| The web portal repo (`elimtiyaz-website`) | This codebase | https://github.com/Vtheonly/elimtiyaz-website |
| A Google Cloud project | For Google OAuth | https://console.cloud.google.com |
| A Firebase project | For FCM push notifications | https://console.firebase.google.com |
| A Vercel account | For hosting the Next.js app | https://vercel.com |
| Node.js 18+ or Bun 1.3+ | For local development | https://nodejs.org or https://bun.sh |
| Supabase CLI (optional but recommended) | For applying migrations + deploying Edge Functions | `brew install supabase/tap/supabase` or `npm i -g supabase` |

**If the desktop app has already been deployed** (the most common case), then:
- The Supabase project already exists with migrations 0001–0024 applied.
- The Storage buckets may already be created.
- You only need to apply migrations 0025–0028 (the web-portal-specific ones) and deploy the 2 Edge Functions.

---

## 3. Phase 1 — Supabase Project Setup

### 3.1 If you're joining an existing Supabase project (recommended)

Skip to [Phase 2 — Database Migrations](#4-phase-2--database-migrations). The Supabase project URL and anon key are all you need from the existing project — get them from:

- **Project URL:** Dashboard → Project Settings → API → Project URL
- **Anon key:** Dashboard → Project Settings → API → `anon` `public` key
- **Service role key:** Dashboard → Project Settings → API → `service_role` key (KEEP SECRET — only used in Edge Functions)

### 3.2 If you're creating a new Supabase project from scratch

1. Go to https://supabase.com → New Project.
2. Fill in:
   - **Name:** `el-imtiyaz-prod` (or your preferred name)
   - **Database Password:** generate a strong password, save it in a password manager
   - **Region:** pick the one closest to your users (e.g. `EU West` for Algeria/France)
   - **Pricing plan:** Free tier works for development; upgrade to Pro for production (RLS + daily backups + no project pausing)
3. Wait ~2 minutes for the project to provision.
4. Apply the **desktop app migrations** first (migrations 0001–0024):
   ```bash
   # Clone the desktop repo if you don't have it:
   git clone https://github.com/Vtheonly/AgentGithubUplaod.git
   cd AgentGithubUplaod/el-imtiyaz/supabase

   # Apply each migration in order. The easiest way is to copy the SQL
   # contents of each file and paste it into the Supabase SQL Editor:
   # Dashboard → SQL Editor → New Query → paste → Run.
   #
   # OR use the Supabase CLI:
   supabase link --project-ref YOUR_PROJECT_REF
   for f in migrations/0001_extensions.sql \
            migrations/0002_tenants_and_users.sql \
            migrations/0003_rbac.sql \
            migrations/0004_academic_structure.sql \
            migrations/0005_crm.sql \
            migrations/0006_pricing.sql \
            migrations/0007_financial.sql \
            migrations/0008_expenses.sql \
            migrations/0009_attendance_hr.sql \
            migrations/0010_workforce.sql \
            migrations/0011_operations.sql \
            migrations/0012_workflow.sql \
            migrations/0013_calendar_notifications_backup.sql \
            migrations/0014_audit.sql \
            migrations/0018_storage.sql \
            migrations/0019_rls_policies.sql \
            migrations/0020_indexes.sql \
            migrations/0021_views.sql \
            migrations/0022_functions.sql \
            migrations/0023_seed.sql \
            migrations/0024_system_settings.sql; do
     echo "Applying $f..."
     supabase db execute --file "$f"
   done
   ```
5. Note down the **Project URL**, **anon key**, and **service_role key** for the next phases.

### 3.3 Create the first tenant (admin user)

After the migrations are applied, you need to create at least one tenant. From the Supabase SQL Editor:

```sql
INSERT INTO public.tenants (slug, name, legal_name, country, default_locale, default_currency, timezone, is_active)
VALUES ('el-imtiyaz', 'El-Imtiyaz', 'École El-Imtiyaz', 'DZ', 'fr', 'DZD', 'Africa/Algiers', true);
```

The desktop app will be used to manage the rest of the tenant configuration (logo, address, etc.).

---

## 4. Phase 2 — Database Migrations

The web portal ships 4 reference SQL migrations in `supabase/migrations/`. Apply them in order:

| Migration | Purpose |
|-----------|---------|
| `0025_device_tokens.sql` | FCM device token registration table + RLS |
| `0026_attendance_justification_columns.sql` | Adds 6 justification columns to `attendance_records` so parents can submit absence justifications from the portal |
| `0027_portal_parent_rls_policies.sql` | 3 RLS policies + 2 BEFORE UPDATE triggers that let parents: (a) update attendance_records but only the justification_* columns, (b) SELECT + INSERT student_documents for their own children, (c) self-update their own parents row but only contact fields |
| `0028_notification_preferences.sql` | Per-category notification opt-in/out table + RLS |

### Apply via Supabase CLI (recommended)

```bash
cd elimtiyaz-website
supabase link --project-ref YOUR_PROJECT_REF

# Apply each migration in order
for f in supabase/migrations/0025_device_tokens.sql \
         supabase/migrations/0026_attendance_justification_columns.sql \
         supabase/migrations/0027_portal_parent_rls_policies.sql \
         supabase/migrations/0028_notification_preferences.sql; do
  echo "Applying $f..."
  supabase db execute --file "$f"
done
```

### Apply via Supabase SQL Editor (alternative)

For each migration file:
1. Open Dashboard → SQL Editor → New Query.
2. Copy the entire contents of the `.sql` file.
3. Paste → Run.
4. Verify the output shows `Success. No rows returned.`

### Verify the migrations

Run this in the SQL Editor to confirm all 4 tables exist with the right structure:

```sql
-- Verify device_tokens
SELECT count(*) FROM public.device_tokens; -- should return 0 (empty table)

-- Verify attendance_records has the new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attendance_records'
  AND column_name LIKE 'justification%';
-- Should return 6 rows: justification_note, justification_path,
-- justification_drive_link, justification_status, justification_reviewed_by,
-- justification_reviewed_at

-- Verify notification_preferences
SELECT count(*) FROM public.notification_preferences; -- should return 0

-- Verify the RLS policies exist
SELECT polname, relname
FROM pg_policy
WHERE relname IN ('attendance_records', 'student_documents', 'parents', 'notification_preferences', 'device_tokens')
ORDER BY relname, polname;
-- Should return ~14 policies

-- Verify the BEFORE UPDATE triggers exist
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname IN ('attendance_records_enforce_parent_columns', 'parents_enforce_self_update_columns');
-- Should return 2 rows
```

---

## 5. Phase 3 — Authentication Configuration

The portal uses **Supabase Auth with Google OAuth** as the only login method. No email/password, no magic links, no SMS.

### 5.1 Enable Google OAuth in Supabase

1. Dashboard → Authentication → Providers → Google → Enable.
2. You'll need a Google Cloud OAuth Client ID + Secret (next step).

### 5.2 Create the Google OAuth credentials

1. Go to https://console.cloud.google.com → select or create a project.
2. APIs & Services → OAuth consent screen:
   - **User type:** External
   - **App name:** `El-Imtiyaz Portal`
   - **Support email:** your admin email
   - **Authorized domains:** `your-project-ref.supabase.co`, `portal.elimtiyaz.dz` (your production domain)
   - Save and continue through the scopes screen (add `userinfo.email` and `userinfo.profile`).
3. APIs & Services → Credentials → Create Credentials → OAuth Client ID:
   - **Application type:** Web application
   - **Name:** `El-Imtiyaz Portal (Supabase)`
   - **Authorized JavaScript origins:**
     - `https://your-project-ref.supabase.co`
     - `https://portal.elimtiyaz.dz` (your production domain — add this after the Vercel deploy)
   - **Authorized redirect URIs:**
     - `https://your-project-ref.supabase.co/auth/v1/callback`
     - `https://portal.elimtiyaz.dz/auth/callback` (production domain — same note as above)
4. Copy the **Client ID** and **Client Secret**.
5. Back in Supabase Dashboard → Authentication → Providers → Google:
   - Paste the Client ID + Client Secret.
   - Save.

### 5.3 Configure the auth flow

The portal uses the PKCE flow with `signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`. Supabase handles the redirect automatically — no extra configuration needed.

The `handle_new_auth_user()` trigger (migration 0002) automatically:
- Inserts a `user_profiles` row with `status = 'pending'`.
- Inserts an `account_approval_requests` row with `status = 'pending'`.
- Resolves the `tenant_id` from the JWT's `app_metadata.tenant_id` (or defaults to the first tenant).

This means: when a parent signs in for the first time, they'll see the "Your account has not yet been activated" screen. They can then either:
- **Path A:** Enter the 6–7 digit activation code the school issued via the desktop app → the `bind-activation-code` Edge Function binds their `auth_user_id` to the master `parents` row and flips `status` to `'active'`.
- **Path B:** Wait for the desktop admin to approve their `account_approval_request` → tap "Actualiser" → the portal re-checks `user_profiles.status`.

### 5.4 (Optional) Configure additional auth settings

- Dashboard → Authentication → URL Configuration:
  - **Site URL:** `https://portal.elimtiyaz.dz` (your production URL)
  - **Redirect URLs:** `https://portal.elimtiyaz.dz/**`, `http://localhost:3000/**` (for local dev)
- Dashboard → Authentication → Email Templates: keep defaults (the portal doesn't send emails — Google OAuth handles notifications).

---

## 6. Phase 4 — Storage Buckets

The portal reads from 5 Storage buckets. If the desktop app is already deployed, these may already exist — verify with:

```sql
SELECT id, name, public FROM storage.buckets ORDER BY name;
```

Expected output should include these 5 buckets:

| Bucket name | Public? | Purpose |
|-------------|---------|---------|
| `attendance-justifications` | ❌ Private | Parent-uploaded absence justification files |
| `student-documents` | ❌ Private | Parent-uploaded documents (birth cert, medical cert, etc.) |
| `receipts` | ❌ Private | Auto-generated receipt + statement PDFs |
| `payment-proofs` | ❌ Private | Check/transfer proof scans uploaded by staff |
| `homework-attachments` | ❌ Private | Teacher-uploaded homework attachments |

### Create missing buckets

For each missing bucket:

1. Dashboard → Storage → New Bucket.
2. **Name:** e.g. `attendance-justifications`.
3. **Public:** ❌ (leave unchecked — all portal buckets are private).
4. Click **Create bucket**.

The RLS policies for these buckets are already defined in migration `0018_storage.sql` (from the desktop repo). The web-portal-specific RLS policies for the `student_documents` table (which references files in the `student-documents` bucket) are in migration `0027_portal_parent_rls_policies.sql`.

### Verify Storage RLS

```sql
SELECT polname, relname
FROM pg_policy
WHERE relname = 'objects' AND schemaname = 'storage'
ORDER BY polname;
```

There should be policies that restrict access to bucket objects based on the bucket name + the parent's auth_user_id.

---

## 7. Phase 5 — Edge Functions

The portal ships 2 Edge Functions in `supabase/functions/`:

| Function | Purpose |
|----------|---------|
| `send-push-notification` | Fans out an FCM HTTP v1 push notification to every active device registered for a given `target_user_id`. Called by workflow actions, the notifications table INSERT trigger, or manual admin triggers from the desktop app. |
| `bind-activation-code` | Implements the Path A self-service activation flow. Called by the portal's activation-code screen. Verifies the caller's JWT, calls the existing `bind_activation_code()` SQL function, flips `user_profiles.status` to `'active'`, inserts a `role_assignments` row. |

### 7.1 Deploy via Supabase CLI

```bash
cd elimtiyaz-website
supabase link --project-ref YOUR_PROJECT_REF

# Deploy both functions
supabase functions deploy send-push-notification
supabase functions deploy bind-activation-code
```

### 7.2 Set the Edge Function secrets

Both functions need the `SUPABASE_SERVICE_ROLE_KEY` secret. The `send-push-notification` function additionally needs the Firebase service-account JSON for FCM HTTP v1.

```bash
# Get your service_role key from Dashboard → Project Settings → API → service_role
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# For send-push-notification (FCM HTTP v1):
# 1. Go to Firebase Console → Project Settings → Service Accounts → Generate new private key.
# 2. Save the JSON file locally as ./firebase-sa.json (DO NOT commit this to git).
# 3. Upload it as a Supabase secret:
supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON=@./firebase-sa.json
supabase secrets set FIREBASE_PROJECT_ID=your-firebase-project-id

# (Legacy: the iteration-3 FCM_SERVER_KEY secret is no longer needed —
#  the HTTP v1 API uses OAuth2 tokens minted from the service account.)
```

### 7.3 Verify the functions are deployed

```bash
supabase functions list
# Should show both functions with the "Deployed" status.
```

You can also test the `bind-activation-code` function with a curl request (replace the placeholders):

```bash
# First, get a valid access token by signing in via Google OAuth on the portal.
# Then:
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/bind-activation-code' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"code":"123456"}'

# Expected response (success):
# {"success":true,"parent_id":"...","parent_full_name":"...","student_count":2}
```

### 7.4 Wire the `send-push-notification` function to fire on notifications INSERT (optional)

The desktop app's workflow engine already calls this function directly when it triggers a notification. If you want notifications to ALSO fire automatically when a row is inserted into the `notifications` table, create a Supabase Webhook:

1. Dashboard → Database → Webhooks → Create Webhook.
2. **Name:** `notify-push-on-insert`
3. **Table:** `notifications`
4. **Events:** `Insert`
5. **Webhook URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification`
6. **Headers:**
   ```json
   {
     "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY",
     "Content-Type": "application/json"
   }
   ```
7. **Body template:**
   ```json
   {
     "target_user_id": "{{ record.target_user_id }}",
     "title": "{{ record.title }}",
     "body": "{{ record.body }}",
     "data": {
       "link_entity_type": "{{ record.link_entity_type }}",
       "link_entity_id": "{{ record.link_entity_id }}",
       "priority": "{{ record.priority }}",
       "category": "{{ record.link_entity_type }}"
     },
     "priority": "{{ record.priority }}"
   }
   ```

Note: the `target_user_id` may be NULL for role-broadcast notifications — in that case, the Edge Function will need to be extended to fan out to every user with that role. For now, the desktop app's workflow engine handles the role-based fan-out server-side.

---

## 8. Phase 6 — Firebase Project (Push Notifications)

The portal uses **Firebase Cloud Messaging (FCM)** for web push notifications. The Android app already uses FCM natively — you can reuse the same Firebase project (recommended) or create a separate one.

### 8.1 Create or reuse a Firebase project

1. Go to https://console.firebase.google.com → Add Project (or select existing).
2. If creating new: name it `el-imtiyaz-prod`, disable Google Analytics (not needed for this use case).

### 8.2 Add a web app

1. Project Overview → `</>` (Web app icon).
2. **App nickname:** `El-Imtiyaz Portal`
3. **Hosting:** skip (we deploy on Vercel).
4. Click **Register app**.
5. Copy the Firebase config object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef",
   };
   ```
   These will become your `NEXT_PUBLIC_FIREBASE_*` env vars.

### 8.3 Generate the VAPID key pair (for web push)

1. Project Settings → Cloud Messaging → Web Push certificates.
2. Click **Generate key pair**.
3. Copy the **public key** (starts with `BOP...`).
4. This becomes your `NEXT_PUBLIC_FIREBASE_VAPID_KEY` env var.

### 8.4 Generate the service-account JSON (for the Edge Function)

1. Project Settings → Service Accounts → Generate new private key.
2. A JSON file downloads — save it as `firebase-sa.json` somewhere safe (NOT in git).
3. Upload it to Supabase as a secret (already done in Phase 5.2):
   ```bash
   supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON=@./firebase-sa.json
   supabase secrets set FIREBASE_PROJECT_ID=your-firebase-project-id
   ```

### 8.5 Verify FCM works

After the portal is deployed (Phase 8) and you've signed in + activated your account:

1. Profile → toggle "Notifications push" on.
2. The browser will prompt for notification permission → Allow.
3. Verify a row appears in `device_tokens`:
   ```sql
   SELECT user_profile_id, platform, is_active, last_seen_at
   FROM public.device_tokens
   WHERE platform = 'web'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
4. Trigger a notification from the desktop app (e.g. record a payment for this parent).
5. The push should arrive within ~5 seconds, even when the portal tab is in the background.

---

## 9. Phase 7 — Local Development Setup

### 9.1 Clone the repo

```bash
git clone https://github.com/Vtheonly/elimtiyaz-website.git
cd elimtiyaz-website
```

### 9.2 Install dependencies

The project uses Bun (recommended) or npm.

```bash
# Option A: Bun (faster, recommended)
bun install

# Option B: npm
npm install
```

### 9.3 Create the `.env.local` file

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# ─── Supabase ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_real_anon_key

# ─── Firebase (FCM web push) ─────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BOP...

# ─── Portal config ───────────────────────────────────────────
NEXT_PUBLIC_APP_NAME=El-Imtiyaz Portal
NEXT_PUBLIC_DEFAULT_LOCALE=fr
```

> ⚠️ **Important:** All `NEXT_PUBLIC_*` env vars are exposed to the browser. NEVER put the `service_role` key in this file — it's only used in Edge Functions and is set via `supabase secrets set`.

### 9.4 Run the dev server

```bash
bun run dev
# OR: npm run dev
```

The portal will be available at http://localhost:3000.

### 9.5 Run tests + lint + build

```bash
bun run test           # 68 unit tests (Vitest)
bun run lint           # ESLint
bun run build          # production build
```

### 9.6 (Optional) Regenerate PWA icons

If you change `public/icon.svg`, regenerate all the PNG icons:

```bash
# Requires Python 3 with cairosvg:
pip install cairosvg
python3 /home/z/my-project/scripts/generate-pwa-icons.py
# OR (if you're running this outside our build environment):
# The script lives at scripts/generate-pwa-icons.py — copy it from the repo.
```

---

## 10. Phase 8 — Vercel Deployment

### 10.1 Push the repo to GitHub

If you haven't already:

```bash
git add .
git commit -m "Iteration 4: feature-complete portal with schema-drift fixes"
git push origin main
```

### 10.2 Import the project in Vercel

1. Go to https://vercel.com → New Project.
2. Import the `elimtiyaz-website` repo.
3. Vercel will auto-detect Next.js — keep the default settings:
   - **Framework Preset:** Next.js
   - **Build Command:** `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
   - **Output Directory:** `.next` (Next.js default)
   - **Install Command:** `bun install` (or `npm install`)
4. **Environment Variables:** add every variable from `.env.local` (see [Reference: All Environment Variables](#15-reference-all-environment-variables)).

   ⚠️ Set the production `NEXT_PUBLIC_SUPABASE_URL` to your real Supabase project URL. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the `anon` key, NOT the service_role key.

5. Click **Deploy**.

### 10.3 Wait for the build to complete

The first build takes ~2 minutes. Watch the build logs — you should see:
```
✓ Compiled successfully in ~10s
✓ Generating static pages (3/3)
Route (app)
┌ ○ /
└ ○ /_not-found
```

### 10.4 Verify the production URL

Vercel assigns a `*.vercel.app` URL automatically. Open it:

1. The login screen should render with the Google sign-in button (NOT the "Configuration manquante" config-error message).
2. Click "Sign in with Google" → complete OAuth.
3. If your account is `pending`, you'll see the activation screen. Either enter a code (Path A) or wait for admin approval (Path B).

### 10.5 Update Google OAuth redirect URIs

After the Vercel deploy, add the production URL to the Google OAuth consent screen:

1. https://console.cloud.google.com → APIs & Services → Credentials → your OAuth Client ID.
2. Add to **Authorized JavaScript origins:**
   - `https://your-app.vercel.app`
   - `https://portal.elimtiyaz.dz` (after you set up the custom domain in Phase 10)
3. Add to **Authorized redirect URIs:**
   - `https://your-app.vercel.app/auth/callback`
   - `https://portal.elimtiyaz.dz/auth/callback`

Also update the Supabase Auth redirect URLs:
- Dashboard → Authentication → URL Configuration → Redirect URLs → add:
  - `https://your-app.vercel.app/**`
  - `https://portal.elimtiyaz.dz/**`

---

## 11. Phase 9 — Post-Deployment Verification

Run through this checklist to confirm everything works end-to-end:

### 11.1 Authentication
- [ ] Visit the production URL → login screen renders with Google sign-in button (no config-error).
- [ ] Click "Sign in with Google" → OAuth flow completes → you're redirected back to the portal.
- [ ] First-time user → "Votre compte n'a pas encore été activé" screen appears.
- [ ] Tap "J'ai un code d'activation" → enter a valid 6–7 digit code issued by the desktop app → "Compte activé" success message.
- [ ] Tap "Actualiser" → dashboard renders.
- [ ] Sign out → login screen reappears.

### 11.2 Dashboard
- [ ] Greeting shows the parent's name.
- [ ] 4 KPIs render (balance due, next installment, attendance rate, average grade).
- [ ] If the parent has multiple children → child switcher appears.
- [ ] Upcoming events list renders (or shows empty state).
- [ ] Recent announcements list renders (or shows empty state).
- [ ] Recent payments list renders (or shows empty state).
- [ ] If `is_financially_restricted = true` → warning banner appears at the top.

### 11.3 Academic
- [ ] GPA card renders.
- [ ] Term tabs (T1/T2/T3/All) work.
- [ ] Per-subject cards render with coefficient + per-assessment pills.
- [ ] "Bulletin" button opens the print dialog with a printable report card.

### 11.4 Attendance
- [ ] 4 KPI counts render (present / excused / unexcused / late).
- [ ] History list renders with status icons.
- [ ] Status pill shows "Justification soumise" for records with submitted justifications.
- [ ] Status pill shows "Justification acceptée" / "refusée" for reviewed records.
- [ ] Tap "Justifier cette absence" → dialog opens → submit note + file → success toast.
- [ ] The record's status pill updates to "Justification soumise".

### 11.5 Homework
- [ ] List of assignments renders for the active child's class.
- [ ] Due-date pills show correct state (À rendre aujourd'hui / J-N / En retard / Verrouillé).
- [ ] Tap an assignment → detail dialog opens.
- [ ] Tap an attachment → signed URL opens in a new tab.

### 11.6 Calendar
- [ ] Month grid renders with current month.
- [ ] Unpaid installment due dates appear as amber dots (derived from `installments.due_date`).
- [ ] Homework due dates appear as warning dots (derived from `homework_assignments.due_date`).
- [ ] Real calendar events appear with the correct color dot.
- [ ] Filter chips work (Tous / Examen / Réunion / Échéance / Paiement / etc.).
- [ ] Tap a day → that day's events list renders below.
- [ ] Upcoming exams section lists exam events with room + invigilator name.

### 11.7 Financial
- [ ] KPI row renders (balance due / paid / total).
- [ ] If `is_financially_restricted = true` → warning banner appears.
- [ ] Installments tab → list of installments with progress bars + status pills.
- [ ] Payments tab → list of payments with receipt download + proof viewer.
- [ ] Invoices tab → list of invoices with status pills.
- [ ] Adjustments tab → list of `account_adjustments` rows with reason code (translated) + amount (credit/debit) + admin note.
- [ ] Receipts tab → list of `receipts` rows (both `recent_payment` and `account_statement`) with download buttons.

### 11.8 Messages
- [ ] Channel list renders (channels where the parent is a member).
- [ ] Tap a channel → conversation view opens.
- [ ] Type a message + Enter → message appears immediately (realtime).
- [ ] Announcement channels are read-only (no composer).
- [ ] Open the portal in a second tab → send a message from tab 1 → tab 2 receives it instantly.

### 11.9 Notifications
- [ ] Bell icon in top app bar shows unread count.
- [ ] Tap a notification → it's marked as read + the portal navigates to the relevant view (deep-linking).
- [ ] Tap "Tout marquer comme lu" → all notifications are marked read.
- [ ] Trigger a notification from the desktop app → it appears in the portal within ~5 seconds (realtime).
- [ ] If push is enabled → a native OS notification also appears.

### 11.10 Profile
- [ ] Profile header shows the parent's avatar + name + parent_code.
- [ ] Account info card shows email, name, phone, status.
- [ ] If `is_financially_restricted = true` → restriction status appears.
- [ ] "Modifier mes informations" → edit form opens → change phone → save → success toast → new phone appears.
- [ ] Notification preferences card → toggle off "Push" for "Absences" → "Enregistrer" → success toast.
- [ ] Documents card → "Téléverser un document" → upload a PDF → success toast → document appears in the list.
- [ ] Language switcher (FR/AR/EN) → UI switches instantly.
- [ ] Theme switcher (dark/light) → theme switches instantly.
- [ ] Push toggle → permission prompt → token registered in `device_tokens`.
- [ ] Sign out → confirmation dialog → confirm → login screen.

### 11.11 PWA
- [ ] Install the portal on Chrome mobile → "Add to Home Screen" → icon appears on the home screen.
- [ ] Open the installed PWA → it opens in standalone mode (no browser chrome).
- [ ] Long-press the home screen icon → 4 quick-action shortcuts appear (Accueil / Paiements / Messages / Notifications).
- [ ] Disconnect the network → offline banner appears → reconnect → data refreshes.
- [ ] When a new version is deployed → "Mettre à jour" banner appears → tap → the SW activates the new version.

### 11.12 Security
- [ ] Open the browser DevTools → Application → Cookies → the `sb-access-token` cookie is `HttpOnly` + `Secure` + `SameSite=Lax`.
- [ ] Network tab → check the response headers on the page request:
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' ...`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Try to read another parent's data (e.g. change the `parent_id` in a query) → RLS should reject it with a 403 or empty result.

---

## 12. Phase 10 — Custom Domain + Production Hardening

### 12.1 Add a custom domain in Vercel

1. Vercel Dashboard → your project → Settings → Domains.
2. Add `portal.elimtiyaz.dz` (or your domain).
3. Vercel will give you DNS records to add:
   - **A record:** `portal` → `76.76.21.21` (or the CNAME Vercel shows)
   - OR **CNAME:** `portal` → `cname.vercel-dns.com`
4. Add the DNS records at your domain registrar.
5. Wait for DNS to propagate (5–60 minutes).
6. Vercel will auto-provision a TLS certificate (Let's Encrypt).

### 12.2 Update all redirect URIs to the production domain

After the custom domain is live:

1. **Google Cloud Console** → APIs & Services → Credentials → your OAuth Client ID:
   - Add to Authorized JavaScript origins: `https://portal.elimtiyaz.dz`
   - Add to Authorized redirect URIs: `https://portal.elimtiyaz.dz/auth/callback`
2. **Supabase Dashboard** → Authentication → URL Configuration:
   - Site URL: `https://portal.elimtiyaz.dz`
   - Redirect URLs: `https://portal.elimtiyaz.dz/**`
3. **Vercel** → Settings → Domains → mark `portal.elimtiyaz.dz` as the primary domain (redirect the `*.vercel.app` URL to it).

### 12.3 Enable Vercel security features

1. Vercel → Settings → Security:
   - ✅ Enable **Vercel Firewall** (free tier: 1000 requests/day).
   - ✅ Enable **DDoS protection** (default on).
2. Vercel → Settings → Speed:
   - ✅ Enable **Vercel Analytics** (free).
   - ✅ Enable **Vercel Speed Insights** (free).
3. (Optional) Vercel → Settings → Edge Functions → add an Edge Middleware for geoblocking if needed.

### 12.4 Set up monitoring

1. **Supabase logs:**
   - Dashboard → Logs → select the `send-push-notification` and `bind-activation-code` functions.
   - Watch for FCM auth failures, expired tokens, or `bind_activation_code` errors.
2. **Vercel logs:**
   - Vercel → your project → Logs → watch for runtime errors.
3. **Sentry (optional):**
   - Create a Sentry project at https://sentry.io.
   - Add `SENTRY_DSN` as a Vercel env var.
   - Add the Sentry Next.js SDK to `next.config.ts` (left as a future enhancement — documented in TODO.md).
4. **Uptime monitoring:**
   - Use a service like https://uptimerobot.com to monitor `https://portal.elimtiyaz.dz` every 5 minutes.

### 12.5 Set up database backups (production)

1. Supabase → Dashboard → Database → Backups.
2. If on the Pro plan ($25/mo): enable daily backups + Point-in-Time Recovery (PITR).
3. For the free tier: set up a daily `pg_dump` cron job:
   ```bash
   #!/bin/bash
   # backup.sh — run daily via crontab
   DATE=$(date +%Y%m%d)
   PGPASSWORD=your_db_password pg_dump \
     -h db.YOUR_PROJECT_REF.supabase.co \
     -U postgres \
     -d postgres \
     -F c \
     -f /backups/supabase-$DATE.dump
   # Retain 30 days of backups
   find /backups -name "supabase-*.dump" -mtime +30 -delete
   ```

---

## 13. Troubleshooting

### 13.1 Login shows "Configuration manquante"

**Cause:** The `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var is missing or contains a placeholder value (`YOUR_...`).

**Fix:**
- Verify the env vars are set in `.env.local` (local dev) or Vercel → Settings → Environment Variables (production).
- Restart the dev server after editing `.env.local`.
- For Vercel: do a new deployment after changing env vars (the build picks them up at build time, not runtime).

### 13.2 Google OAuth redirects to a 404

**Cause:** The redirect URI is not registered in Google Cloud Console or Supabase.

**Fix:**
- Google Cloud Console → Credentials → your OAuth Client ID → Authorized redirect URIs → add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
- Supabase → Authentication → URL Configuration → Redirect URLs → add `https://portal.elimtiyaz.dz/**`.

### 13.3 Account stuck in "pending" after activation code entry

**Cause:** The `bind-activation-code` Edge Function failed, OR the `bind_activation_code()` SQL function returned an error.

**Fix:**
- Check the Edge Function logs: `supabase functions logs bind-activation-code`.
- Common errors:
  - `Invalid or already-used activation code` — the code was already bound to another auth_user_id, OR the code doesn't exist. Generate a new code from the desktop app.
  - `This activation code has expired` — codes expire after 30 days by default. Generate a new one.
  - `Account is already active` — the user_profiles.status is already 'active'. Just tap "Actualiser".
- If the function succeeded but the portal still shows "pending", tap "Actualiser" — the auth provider re-fetches `user_profiles.status`.

### 13.4 Push notifications don't arrive

**Cause:** One of several possible failure points.

**Debugging steps:**
1. Verify the parent enabled push: Profile → toggle is ON → check `device_tokens` table:
   ```sql
   SELECT user_profile_id, platform, is_active, last_seen_at
   FROM public.device_tokens
   WHERE platform = 'web' AND is_active = true;
   ```
2. Verify the Edge Function is deployed: `supabase functions list`.
3. Trigger a test notification from the desktop app → check the Edge Function logs:
   ```bash
   supabase functions logs send-push-notification --limit 50
   ```
4. Common errors in the logs:
   - `FIREBASE_SERVICE_ACCOUNT_JSON secret not set` → re-run `supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON=@./firebase-sa.json`.
   - `OAuth2 token exchange failed` → the service-account JSON is malformed or expired. Re-generate it.
   - `UNREGISTERED` → the FCM token is stale. The function auto-marks it inactive; the next time the parent opens the portal, `initFcm()` will re-register a fresh token.
   - `user has opted out of push for this category` → the parent disabled push for this notification's category in their preferences. This is expected behavior, not an error.
5. On iOS Safari: web push requires iOS 16.4+. Older versions silently fail. Check `navigator.serviceWorker` and `'Notification' in window`.

### 13.5 Realtime subscriptions don't fire

**Cause:** Supabase Realtime needs to be enabled on the project, and the tables need to be added to the Realtime publication.

**Fix:**
1. Dashboard → Database → Replication → Realtime → ensure these tables are added:
   - `notifications`
   - `chat_messages`
   - `installments`
   - `payments`
   - `homework_assignments`
2. The portal's `use-realtime.ts` hook subscribes to these tables. If a table is missing from Realtime, the hook silently fails (no errors, but no invalidation).

### 13.6 Storage upload fails with "Row Level Security"

**Cause:** The Storage bucket RLS policies aren't set up, OR the bucket name doesn't match.

**Fix:**
1. Verify the bucket exists: `SELECT id, name FROM storage.buckets;`
2. Verify the RLS policy on `storage.objects` allows the parent to insert into the bucket. The policy is defined in migration `0018_storage.sql` (desktop repo). If missing, re-apply that migration.
3. Check the bucket name in the portal code matches the bucket name in Supabase exactly (case-sensitive). The portal uses:
   - `attendance-justifications`
   - `student-documents`
   - `receipts`
   - `payment-proofs`
   - `homework-attachments`

### 13.7 Build fails on Vercel

**Cause:** Most commonly a missing or invalid env var, or a TypeScript error.

**Fix:**
- Check the Vercel build log — the error message tells you which file/line failed.
- Common: `Cannot find module '@/lib/env'` → make sure all the source files are committed to git.
- Common: `NEXT_PUBLIC_SUPABASE_URL is not defined` → the env var is missing in Vercel → Settings → Environment Variables.
- The project's `next.config.ts` has `typescript.ignoreBuildErrors: true` (a leftover from iteration 3) — we don't recommend changing this in production, but if you do, run `bun run lint` locally to catch TypeScript errors before deploying.

### 13.8 PWA install prompt doesn't appear

**Cause:** The manifest is missing required fields, OR the icons are missing, OR the page is served over HTTP (not HTTPS).

**Fix:**
1. Verify the production URL is HTTPS (Vercel does this automatically).
2. Open Chrome DevTools → Application → Manifest → verify there are no warnings.
3. Verify all icon files exist: `https://portal.elimtiyaz.dz/icon-192.png`, etc.
4. The install prompt requires:
   - A valid manifest with at least 192×192 + 512×512 PNG icons.
   - A registered service worker that handles `fetch` events.
   - The page must be served over HTTPS.
5. On iOS Safari: the "Add to Home Screen" button is in the Share sheet — it doesn't auto-prompt. The portal's `pwa-install-prompt.tsx` shows a banner that explains this for iOS users.

### 13.9 Calendar shows no events

**Cause:** Either there are no calendar_events rows, OR the `is_deleted` filter is excluding all of them, OR the parent has no installments/homework to derive events from.

**Fix:**
1. Check the SQL:
   ```sql
   SELECT count(*), max(start_at) FROM public.calendar_events WHERE is_deleted = false;
   ```
2. If 0: the desktop app hasn't created any events yet. Create a test event:
   ```sql
   INSERT INTO public.calendar_events (tenant_id, kind, title, start_at, all_day, is_deleted)
   SELECT id, 'meeting', 'Test event', now() + interval '1 day', false, false
   FROM public.tenants WHERE slug = 'el-imtiyaz';
   ```
3. Check the derived events:
   ```sql
   SELECT count(*) FROM public.installments WHERE status != 'paid';
   SELECT count(*) FROM public.homework_assignments;
   ```
4. The portal's calendar view only shows events from the current month onwards. Navigate to the next month to see future events.

### 13.10 Messages don't send

**Cause:** Most commonly a Zod validation failure (empty body or > 5000 chars) or an RLS rejection.

**Fix:**
1. Check the browser DevTools console for the error message.
2. Verify the parent is a member of the channel:
   ```sql
   SELECT id, name, member_ids
   FROM public.chat_channels
   WHERE member_ids @> ARRAY['USER_PROFILE_ID'::uuid];
   ```
3. If `member_ids` is empty or doesn't include the parent's `user_profiles.id`, the channel was created incorrectly from the desktop app. Add the parent:
   ```sql
   UPDATE public.chat_channels
   SET member_ids = array_append(member_ids, 'USER_PROFILE_ID'::uuid)
   WHERE id = 'CHANNEL_ID';
   ```

---

## 14. Rollback Procedure

If a deployment goes wrong, here's how to roll back:

### 14.1 Vercel rollback (instant)

1. Vercel → your project → Deployments.
2. Find the last known-good deployment.
3. Click the `...` menu → **Promote to Production**.
4. The previous deployment becomes live immediately.

### 14.2 Edge Function rollback

```bash
# List previous deployments
supabase functions list

# Re-deploy a specific previous version (if you have the git SHA)
git checkout <previous-sha>
supabase functions deploy send-push-notification
supabase functions deploy bind-activation-code
```

### 14.3 Database migration rollback

The migrations are designed to be **additive** — they don't drop columns or tables, so rollback is generally safe. If you need to undo a migration:

```sql
-- 0028 rollback
DROP TABLE IF EXISTS public.notification_preferences CASCADE;

-- 0027 rollback
DROP POLICY IF EXISTS attendance_parent_update_justification ON public.attendance_records;
DROP POLICY IF EXISTS student_documents_parent_select ON public.student_documents;
DROP POLICY IF EXISTS student_documents_parent_insert ON public.student_documents;
DROP POLICY IF EXISTS parents_self_update ON public.parents;
DROP TRIGGER IF EXISTS attendance_records_enforce_parent_columns ON public.attendance_records;
DROP FUNCTION IF EXISTS public.enforce_parent_attendance_update_columns();
DROP TRIGGER IF EXISTS parents_enforce_self_update_columns ON public.parents;
DROP FUNCTION IF EXISTS public.enforce_parent_self_update_columns();

-- 0026 rollback
ALTER TABLE public.attendance_records
  DROP COLUMN IF EXISTS justification_note,
  DROP COLUMN IF EXISTS justification_path,
  DROP COLUMN IF EXISTS justification_drive_link,
  DROP COLUMN IF EXISTS justification_status,
  DROP COLUMN IF EXISTS justification_reviewed_by,
  DROP COLUMN IF EXISTS justification_reviewed_at;

-- 0025 rollback
DROP TABLE IF EXISTS public.device_tokens CASCADE;
```

⚠️ **Warning:** rolling back migration 0025 will delete all FCM device tokens — push notifications will stop working until parents re-enable them.

---

## 15. Reference: All Environment Variables

### Web portal (`.env.local` or Vercel env vars)

All of these are `NEXT_PUBLIC_*` (exposed to the browser). Set them in Vercel → Settings → Environment Variables for production, and in `.env.local` for local dev.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL, e.g. `https://YOUR_PROJECT_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | The `anon` `public` key from Supabase Dashboard → Settings → API. NEVER use the `service_role` key here. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | For push | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | For push | Usually `YOUR_PROJECT.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | For push | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | For push | Usually `YOUR_PROJECT.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | For push | The sender ID from Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | For push | The web app ID (e.g. `1:1234:web:abcd`) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | For push | The VAPID public key (Project Settings → Cloud Messaging → Web Push certificates) |
| `NEXT_PUBLIC_APP_NAME` | Optional | App display name. Default: `El-Imtiyaz Portal` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Optional | Default language: `fr` (default), `ar`, or `en` |

### Edge Function secrets (set via `supabase secrets set`)

These are server-side only — they are NOT exposed to the browser.

| Secret | Required by | Description |
|--------|-------------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Both functions | The `service_role` key from Supabase Dashboard → Settings → API. Used to verify the caller's JWT and perform admin operations (updating `user_profiles.status`, inserting `role_assignments`). |
| `SUPABASE_URL` | Both functions | Auto-set by Supabase Edge Functions runtime. Usually `https://YOUR_PROJECT_REF.supabase.co`. |
| `SUPABASE_ANON_KEY` | `bind-activation-code` | Auto-set by Supabase Edge Functions runtime. Used to build the user-scoped client. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `send-push-notification` | The full JSON content of the Firebase service-account key file. Used to mint OAuth2 tokens for the FCM HTTP v1 API. |
| `FIREBASE_PROJECT_ID` | `send-push-notification` | The Firebase project ID. Used to build the FCM HTTP v1 endpoint URL. |

---

## Quick Reference: Deploy Commands Cheat Sheet

```bash
# ─── 1. Apply migrations ──────────────────────────────────────
cd elimtiyaz-website
supabase link --project-ref YOUR_PROJECT_REF
for f in supabase/migrations/0025_device_tokens.sql \
         supabase/migrations/0026_attendance_justification_columns.sql \
         supabase/migrations/0027_portal_parent_rls_policies.sql \
         supabase/migrations/0028_notification_preferences.sql; do
  supabase db execute --file "$f"
done

# ─── 2. Deploy Edge Functions ─────────────────────────────────
supabase functions deploy send-push-notification
supabase functions deploy bind-activation-code

# ─── 3. Set Edge Function secrets ─────────────────────────────
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON=@./firebase-sa.json
supabase secrets set FIREBASE_PROJECT_ID=your-firebase-project-id

# ─── 4. Local dev ─────────────────────────────────────────────
cp .env.local.example .env.local
# Edit .env.local with your real values
bun install
bun run dev  # → http://localhost:3000

# ─── 5. Production build + test ───────────────────────────────
bun run test      # 68 unit tests
bun run lint      # 0 errors
bun run build     # production build

# ─── 6. Deploy to Vercel ──────────────────────────────────────
# (via Vercel Dashboard → Import Git Repo → add env vars → Deploy)
# OR via Vercel CLI:
npm i -g vercel
vercel --prod
```

---

## Support

If you run into issues not covered here:

1. Check the `Troubleshooting` section above.
2. Read the in-code documentation — every file has a header comment explaining its purpose.
3. Check the `DONE.md` and `TODO.md` files for the iteration history and known limitations.
4. Cross-reference the desktop app's documentation in `desktop-app/el-imtiyaz/docs/` for backend-specific questions.

The portal is **production-ready** — the only remaining work is infrastructure setup that requires real credentials and dashboard access, all of which is documented above.
