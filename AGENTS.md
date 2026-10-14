# AGENTS.md — elimtiyaz-website Repository Manual

> Operating manual for AI coding agents working in **this** repository. System-level documentation (architecture, canonical rules, problem registry, task registry, ADRs) lives in the **hub repository** `AgentGithubUplaod` — check it out as a sibling or consult it before any non-trivial change. Start there: `AgentGithubUplaod/AGENTS.md`.

## 1. What this repository is

The **parent web portal** of the El-Imtiyaz school-management system: Next.js 16 (App Router) + TanStack Query + Tailwind + PWA, hash-routed, talking directly to the shared Supabase backend (Google OAuth). It is **read-mostly**: parents view balances, installments, payments, attendance, homework, bulletins and notifications; the only writes are activation-code binding, absence-justification submission, notification read-state and FCM registration.

- Build: `npm run build` (standalone output) · Dev: `npm run dev` (port 3000) · Tests: `npm run test` (vitest) · Lint: `npm run lint`
- Build is STRICT since T-049 (2026-08-29): `ignoreBuildErrors: false` + `reactStrictMode: true`; `npm run build` runs TypeScript and must stay green. (ARCH-005 fixed — do not re-enable error ignoring.)

## 2. Repository map

```
src/
├── app/               # App Router: page.tsx state machine, providers (auth, query)
├── components/
│   └── particle-canvas.tsx  # T-530: the desktop's particle-animation wrapper — the login
│                      #   hero's interactive brand field (the exact desktop logo
│                      #   public/intro-logo.png formed from its dark pixels;
│                      #   pointer-reactive, prefers-reduced-motion-gated). The FOUR
│                      #   website-only adaptations live HERE, never in the engine.
├── features/          # views: dashboard, financial, attendance, messages, notifications,
│                      #   homework, academic/bulletin, profile, auth (login/activation)
├── lib/
│   ├── canonical/     # ported desktop canonical engine (read-side) consumed by portal-derive.ts
│   ├── particle-engine/  # T-530/UI-344: the VERBATIM §9 port of the hub's
│                      #   elimtiyaz-desktop/src/shared/particle-engine/** (12 files,
│                      #   provenance headers, logic byte-equivalent — any change must
│                      #   be mirrored in the desktop engine). The md5-pinned brand
│                      #   asset regression test lives here too.
│   ├── hooks/         # portal-queries.ts (all Supabase queries), use-realtime.ts (6 hooks:
│   │                  #   useRealtimeInvalidation + notifications/chat-messages/chat-unread/
│   │                  #   financial/homework subscriptions), fcm-registration.ts
│   ├── auth/          # auth-provider.tsx (mock-auth.ts REMOVED 2026-08-29, SEC-007/T-009 — Google OAuth is the only auth path)
│   ├── types/         # database.ts typed schema (strict: 38 row type aliases + Relationships since T-049)
│   ├── bulletin.ts    # report-card PDF generation
│   └── supabase/      # client + middleware helpers
├── components/, public/, middleware.ts
public/
└── intro-logo.png    # T-530: the EXACT desktop brand pictogram, byte-identical (md5
                       #   a1efb238f3c433968f6b267db9b8cb9e — JPEG bytes under a .png name,
                       #   INTENTIONAL: browsers content-sniff; never re-encode/rename)
supabase/
└── functions/         # EMPTY since T-146 (2026-09-03): bind-activation-code joined the
                       # hub-owned set (ADR-011 resolved UNKNOWN-001). send-push-notification was
                       # REMOVED 2026-09-02 (T-126). NEVER recreate an EF here — the canonical
                       # sources live in the hub repo only
```

> **Migrations (T-048, 2026-08-31):** the four portal-patch migrations
> (0025–0028) that used to live in `supabase/migrations/` were REMOVED —
> their content was absorbed by the hub's canonical chain (0043
> portal_alignment) and their numbering collided with the desktop chain
> (CROSS-001). NEVER recreate a `supabase/migrations/` directory in this
> repo: schema changes go to the hub repo as new migrations (ADR-001).

## 3. Role in the system & critical context

- All money/KPI computations must go through `src/lib/canonical/` + `portal-derive.ts` (the ported canonical engine) — never inline formulas. Known inline-formula defects to avoid repeating: dashboard remaining-amount (WEAK-018), attendance rate (WEAK-019 family), 500-entry ledger cap (WEAK-022).
- **Payment coverage (T-330, 58th session):** the "what does this payment cover" derivation lives ONCE in `src/lib/canonical/payment-coverage.ts` — the canonical chain `payment_allocations` rows → ledger receipt-number join → single-category line, in lockstep with the desktop's PaymentBreakdownCard (PARITY-004). Views consume `paymentCoverageLines()`; NEVER re-derive allocations inline (guarded by t-214 + the canonical parity suite).
- **The per-child dossier (T-329, 58th session):** every user-facing string in the dossier dialog routes through the dictionary (fr/ar/en) — the 58th-session audit found ~40 hardcoded French strings in the previous iteration (guarded by t-214). The academic history reads `student_academic_histories` through `useStudentAcademicHistories` (the 0029 canonical table; parents read it under hub migration 0091's policy).
- **The desktop layout (T-327, 58th session):** the app shell is `lg:flex-row` with a STICKY full-height DesktopRail; every responsive grid keeps its base `grid-cols-*` token (UI-300); views own a deliberate width hierarchy (dashboard 7xl / financial 6xl / reading 5xl / profile 2xl). Guarded by t-214.
- **Financial view structure (session 8, 2026-08-30):** tabs are Tranches | Paiements | **Relevé** (ledger statement timeline — `ledgerTimeline` replay with running balance) | Ajustements (derived from `ledger_entries` via `ledgerAdjustmentEntries` — the `account_adjustments` table is EMPTY in production). The old invoices/receipts standalone tabs were REMOVED (0 rows / orphaned table — CROSS-101); per-payment receipt download is retained for when the backend generates rows. Payment status is rendered from the row (never hardcoded "paid"); parent names use `formatParentName` (display_name first — `parents.first_name` is an empty string on ALL 258 production rows).
- Realtime freshness: the 4 defect families found by the audit are FIXED (T-032, 10th session — regression suite `src/lib/hooks/realtime-wiring.test.ts`): homework subscribes to the CANONICAL `homework` table (WEAK-016), the unread-badge invalidation key matches element-wise (REALTIME-100), markRead failures surface (REALTIME-101), the notifications subscription has NO direct-target filter so role-broadcasts arrive (REALTIME-102), and the unread badge reacts to all channels incl. the shell-level chat subscription (REALTIME-103). The freshness FALLBACK for a dead realtime connection landed with T-033 (11th session): global query defaults keep data stale-bounded — regression suite `src/test/t-033-freshness-fallback.test.tsx`.
- **Sign-out (SYNC-105 fixed 2026-08-30):** `AuthProvider.signOut` deactivates this device's FCM token (canonical `deactivate_fcm_tokens` RPC, migration 0050) then revokes with `scope:'local'` — never 'global' (a parent signing out on one device must not kill the family's other sessions).
- The chat MessagesView is **LIVE since session 14 (2026-08-31)**: chat is a committed feature (ADR-008 — owner decision, UNKNOWN-005 resolved). The portal is **read+reply for staff-opened channels** PLUS the parent-initiated **“Contacter l'administration”** action (T-149, 2026-09-03 — ADR-012 amends ADR-008 per the owner's mandate: the web messenger connects parents to the **Administrator** one-on-one; parent↔parent channels are forbidden and enforced server-side by migration 0067's tightened `chat_messages_insert` policy). Staff still open channels from the desktop's parent-detail-drawer (“Messager” → canonical `create_direct_channel` RPC, migration 0061). Portal-side ordering is by `last_message_at` (0051 read-receipt policy + 0061 trigger maintain the data); archived channels are hidden.
- The mock-admin authentication system was REMOVED 2026-08-29 (SEC-007 fixed by T-009): Google OAuth is the only auth path; a planted `mock-auth-session` key yields no session (regression-tested). Do not re-introduce any client-side mock auth.
- **The login brand field (T-530/UI-344, 2026-10-14):** the login hero renders the desktop's particle animation — `ParticleCanvas` + the verbatim `src/lib/particle-engine/` port, the particles forming the EXACT desktop logo (`public/intro-logo.png`, md5-pinned by `src/lib/particle-engine/particle-engine.test.ts`). The canvas is decorative (`aria-hidden`, `prefers-reduced-motion`-gated, pointer-reactive, ~1,600 particles at density 2 — the mobile-first budget). The engine is a VERBATIM §9 port — logic changes must be mirrored in the hub's `elimtiyaz-desktop/src/shared/particle-engine/`; the website-only adaptations (URL constant, pointer events, reduced-motion, resize re-init) live ONLY in `src/components/particle-canvas.tsx` (hub AGENTS.md §15.107). The Android app does NOT carry the particle animation (owner directive).
- **The presentation-polish layer (T-531/UI-345, 2026-10-14):** the portal's visual language (the public screens + the progress/skeleton primitives) is centralized: (1) the shared **`src/components/ui/progress.tsx`** is the ONE determinate progress bar (progressbar semantics, gradient fill, shimmer) — NEVER hand-roll another `bg-muted rounded-full` track inline (the financial view's two retired bars are the cautionary tale; guarded by `src/test/t-531-visual-polish.test.tsx`); (2) the motion utilities (`progress-track`/`progress-bar-sweep`/`progress-fill`/`skeleton-shimmer`/`animate-fade-up`/`brand-grid-overlay`/`card-glow`/`btn-glow`/`brand-text-gradient`) live in `globals.css` — ALL are frozen by the GLOBAL `prefers-reduced-motion` guard at that file's bottom, so any NEW animation must be added to the guard's selector list too; (3) the login's desktop layout mirrors the DESKTOP app's side-panel split (`lg:grid-cols-[minmax(480px,42%)_1fr]`, full-height bordered brand panel, `h-[44vh]` field) — keep it in sync with the desktop's `elimtiyaz-desktop/src/features/auth/login-screen.tsx` pattern, and keep the static brand-mark layer (`img invert mix-blend-screen` under the canvas — the instant-paint + reduced-motion presentation) whenever the canvas is used; (4) the view containers follow the widescreen LADDER (`max-w-5xl` base → `xl:max-w-6xl` → `2xl:max-w-7xl`, financial/dashboard → `2xl:max-w-[1440px]`, responsive `sm:px-6 lg:px-8` gutters) — standard laptop widths are the T-327 contract, do not shrink them back.

## 4. Before changing anything (mandatory)

1. Read the hub `AGENTS.md` and the relevant hub docs (source-of-truth registry first).
2. Read your task in `AgentGithubUplaod/docs/recovery/task-registry.md` and its problem entries (this repo owns: SEC-007/008, CROSS-009/101, WEAK-016/017/018/019/020/022/023, DEAD-012/013/014, DRIFT-009/010, ARCH-005, CACHE-100, REALTIME-100…103, NOTIF-103, PUSH-103, SYNC-105, ATT-101, GRADE-101-family …). When you need the full end-to-end trace or git forensics behind a problem ID, read the raw finding in `AgentGithubUplaod/docs/audits/` (read-only archive; see its README for ID-mapping rules).
3. Search this repo AND the hub repo for existing implementations; check whether the desktop already solves it (canonical engine, repository patterns).
4. Check `AgentGithubUplaod/docs/recovery/unknowns.md` for anything your change depends on (UNKNOWN-001 was RESOLVED by ADR-011/T-146, 2026-09-03 — binding an activation code activates the account; UNKNOWN-004 blocks the receipt feature; UNKNOWN-005 was resolved by ADR-008).
5. Follow the hub's workflow (`docs/agents/workflow.md`) and commit standard (`docs/agents/git-workflow.md`).

## 5. During implementation (website-specific rules)

- Queries live in `portal-queries.ts`; views consume hooks — no direct `supabase.from(...)` in components except where an existing pattern does so deliberately.
- Realtime hooks must subscribe to **canonical** tables with canonical columns (`homework.class_id`, not `homework_assignments.target_class_id`).
- TanStack invalidation keys must match the actual query keys element-wise (see REALTIME-100 for the failure mode).
- No financial writes; no local Edge Functions (all EFs are hub-owned since T-146 — including bind-activation-code, whose ADR-011 activation semantics were consolidated into the hub's canonical version).
- Respect the typed `Database` interface — extend it when touching new tables instead of `as unknown as` casts (WEAK-017).
- Keep `NEXT_PUBLIC_*` flags truthful; feature flags gate UI **and** behaviour (the mock-auth flag violated this — SEC-007).
- **Mobile-first layout rules (T-199..T-203, 2026-09-06 — all source-scan-guarded):** (a) every responsive grid MUST declare a base `grid-cols-*` (a bare `grid gap-*` that only gains columns at a breakpoint blows out ~900px on mobile — UI-300, guarded by `t-199`); (b) Intl currency output is UNBREAKABLE text (U+202F/U+00A0 separators) — width-constrained money surfaces need `break-words` + a mobile size step at the DISPLAY layer, and the FORMATTER is parity-pinned (guarded by `t-200`); (c) header rows with action clusters must `flex-wrap` + `gap-y` (guarded by `t-201`); (d) multi-label tab bars scroll below sm (`overflow-x-auto scrollbar-none`, the established chip-row idiom — guarded by `t-202`); (e) the calendar kind→label mapping lives ONCE in `src/features/calendar/event-kind.ts` (guarded by `t-203`). Live verification recipe: `AgentGithubUplaod/docs/testing/strategy.md` §6.
- **NEVER read `process.env.NEXT_PUBLIC_*` directly in a client component** (T-184/ACT-201, 2026-09-05): Next.js inlines those values at BUILD time — a deployment host that hasn't set them yields `undefined` in the bundle (the production 404 `/undefined/functions/v1/bind-activation-code` that broke EVERY activation attempt). Always resolve through `@/lib/env`, which falls back to the committed `PUBLIC_CONFIG_DEFAULTS` (T-096). A whole-src regression test enforces this (`src/test/t-184-activation-ef-url.test.ts`).
- **Every user-visible string routes through the dictionary (T-385/I18N-500, 2026-09-17 — machine-enforced):** the portal is a 3-locale application (fr/ar/en). New UI text goes into `src/lib/i18n/dictionary.ts` in ALL THREE locales in the same change (a key landing in one locale only is the T-187 failure mode — the `t-385` guard fails the suite on any fr/ar/en key drift, any duplicate key, and any hardcoded user-visible literal the AST scanner finds). Zod validation messages are DICTIONARY KEYS (`validation.*`) — the toast seams translate (`t(message)`), never toast a raw message. The canonical layer (billing-breakdown / service-pricing-profile) keeps its verbatim French labels (ADR-002 parity) — localize at the DISPLAY layer via stable code→key mappings (the UI-304 precedent: `finance.adjust.provenance.*`, `finance.svc.category.*`). Document `lang`/`dir` come from the LocaleProvider — never hardcode `dir` on a layout. Scope decisions that stand: PDFs, app metadata and the PWA manifest stay French (WinAnsi + static-export constraints — see I18N-500); `format.ts` formatters are parity-pinned (t-200).

## 6. Before finishing

1. `npm run lint` + `npm run test` green; `npm run build` green.
2. Inspect the full diff; confirm no duplicate implementation, no unrelated changes.
3. Cross-platform check: canonical formulas shared with desktop/Android (equivalence for read-side computations).
4. Update the hub registries (problem status, task status, change-log) and commit per the git standard.
5. Never claim VERIFIED without evidence — see `AgentGithubUplaod/docs/recovery/definition-of-done.md`.

## 7. Commit rule (applies to every commit in this repo)

Every commit body must answer five questions (hub `AGENTS.md` §14, full template in `AgentGithubUplaod/docs/agents/git-workflow.md`): **which task was completed** (`Task:` — T-ID + status reached) · **what is left** (`Left:`) · **what was changed** (`Change:` + `Preserved:`) · **what was verified** (`Verified:` — real commands and real results, e.g. `npm run test` with the test count) · **the next task** (`Next:` — T-ID + one-line reason). The commit records progress for the next agent, not just the change for git.

## 8. Verification commands (quick reference)

```bash
npm run lint          # eslint
npm run test          # vitest (60 files / 730 tests, session 174)
npm run build         # next build (strict after T-049)
```

> **Out-of-the-box config (T-096, session 14):** a fresh clone works WITHOUT `.env.local` —
> public identifiers (Supabase URL + anon key + the FULL Firebase web config of the current
> `elimtiyaz-production` project, T-519/CONFIG-501 — including the web-push VAPID key
> committed in T-520/CONFIG-502: FCM web push is ENABLED out of the box, `isFcmConfigured`
> is true, and the T-121 env warning is silenced) are committed in
> `src/lib/public-config.ts` and `env.ts` falls back to
> them. `.env.local` still overrides every value. NEVER commit server secrets
> (service_role / sb_secret / sbp_) — a regression test scans for them
> (`src/lib/t-096-portal-default-config.test.ts`).

> **Zod runs jitless (T-524/SEC-116, 2026-10-13):** `src/lib/env.ts` and
> `src/lib/validation.ts` — the portal's ONLY Zod importers (census-pinned by
> `src/test/t-524-zod-jitless-csp.test.ts`) — call `z.config({ jitless: true })`
> BEFORE defining any schema. Reason: the CSP (src/middleware.ts) deliberately
> excludes `'unsafe-eval'`, and Zod 4 otherwise probes `Function("")` at
> schema-definition time — logging a CSP-violation console error on every page
> load before falling back to its (behaviour-identical) interpreted parser.
> Never add `'unsafe-eval'` to the CSP to "fix" library console noise — align
> the library to the policy instead. A NEW Zod-importing file must carry the
> same declaration before its first schema (the census test fails otherwise).

## 9. Forbidden in this repository

- Any financial write path (the portal is read-mostly by design).
- Restoring or extending mock-auth in any form.
- Editing or applying `supabase/migrations/*` (hub-owned, ADR-001). The 4 portal patches were REMOVED from this repo in T-048 (2026-08-31) — never restore them.
- Duplicating or forking hub Edge Functions.
- Disabling type-checking/lint/tests to ship.
- Creating documentation or task lists here — everything belongs in the hub (ADR-007). This file is the only documentation this repo carries.
- History rewrites of any kind.
