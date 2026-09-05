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
├── features/          # views: dashboard, financial, attendance, messages, notifications,
│                      #   homework, academic/bulletin, profile, auth (login/activation)
├── lib/
│   ├── canonical/     # ported desktop canonical engine (read-side) consumed by portal-derive.ts
│   ├── hooks/         # portal-queries.ts (all Supabase queries), use-realtime.ts (6 hooks:
│   │                  #   useRealtimeInvalidation + notifications/chat-messages/chat-unread/
│   │                  #   financial/homework subscriptions), fcm-registration.ts
│   ├── auth/          # auth-provider.tsx (mock-auth.ts REMOVED 2026-08-29, SEC-007/T-009 — Google OAuth is the only auth path)
│   ├── types/         # database.ts typed schema (strict: 38 row type aliases + Relationships since T-049)
│   ├── bulletin.ts    # report-card PDF generation
│   └── supabase/      # client + middleware helpers
├── components/, public/, middleware.ts
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
- **Financial view structure (session 8, 2026-08-30):** tabs are Tranches | Paiements | **Relevé** (ledger statement timeline — `ledgerTimeline` replay with running balance) | Ajustements (derived from `ledger_entries` via `ledgerAdjustmentEntries` — the `account_adjustments` table is EMPTY in production). The old invoices/receipts standalone tabs were REMOVED (0 rows / orphaned table — CROSS-101); per-payment receipt download is retained for when the backend generates rows. Payment status is rendered from the row (never hardcoded "paid"); parent names use `formatParentName` (display_name first — `parents.first_name` is an empty string on ALL 258 production rows).
- Realtime freshness: the 4 defect families found by the audit are FIXED (T-032, 10th session — regression suite `src/lib/hooks/realtime-wiring.test.ts`): homework subscribes to the CANONICAL `homework` table (WEAK-016), the unread-badge invalidation key matches element-wise (REALTIME-100), markRead failures surface (REALTIME-101), the notifications subscription has NO direct-target filter so role-broadcasts arrive (REALTIME-102), and the unread badge reacts to all channels incl. the shell-level chat subscription (REALTIME-103). The freshness FALLBACK for a dead realtime connection landed with T-033 (11th session): global query defaults keep data stale-bounded — regression suite `src/test/t-033-freshness-fallback.test.tsx`.
- **Sign-out (SYNC-105 fixed 2026-08-30):** `AuthProvider.signOut` deactivates this device's FCM token (canonical `deactivate_fcm_tokens` RPC, migration 0050) then revokes with `scope:'local'` — never 'global' (a parent signing out on one device must not kill the family's other sessions).
- The chat MessagesView is **LIVE since session 14 (2026-08-31)**: chat is a committed feature (ADR-008 — owner decision, UNKNOWN-005 resolved). The portal is **read+reply for staff-opened channels** PLUS the parent-initiated **“Contacter l'administration”** action (T-149, 2026-09-03 — ADR-012 amends ADR-008 per the owner's mandate: the web messenger connects parents to the **Administrator** one-on-one; parent↔parent channels are forbidden and enforced server-side by migration 0067's tightened `chat_messages_insert` policy). Staff still open channels from the desktop's parent-detail-drawer (“Messager” → canonical `create_direct_channel` RPC, migration 0061). Portal-side ordering is by `last_message_at` (0051 read-receipt policy + 0061 trigger maintain the data); archived channels are hidden.
- The mock-admin authentication system was REMOVED 2026-08-29 (SEC-007 fixed by T-009): Google OAuth is the only auth path; a planted `mock-auth-session` key yields no session (regression-tested). Do not re-introduce any client-side mock auth.

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
- **NEVER read `process.env.NEXT_PUBLIC_*` directly in a client component** (T-184/ACT-201, 2026-09-05): Next.js inlines those values at BUILD time — a deployment host that hasn't set them yields `undefined` in the bundle (the production 404 `/undefined/functions/v1/bind-activation-code` that broke EVERY activation attempt). Always resolve through `@/lib/env`, which falls back to the committed `PUBLIC_CONFIG_DEFAULTS` (T-096). A whole-src regression test enforces this (`src/test/t-184-activation-ef-url.test.ts`).

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
npm run test          # vitest (20 files / 425 tests, session 17)
npm run build         # next build (strict after T-049)
```

> **Out-of-the-box config (T-096, session 14):** a fresh clone works WITHOUT `.env.local` —
> public identifiers (Supabase URL + anon key + Firebase web config sans VAPID/web-app-id) are
> committed in `src/lib/public-config.ts` and `env.ts` falls back to them. `.env.local` still
> overrides every value. NEVER commit server secrets (service_role / sb_secret / sbp_) — a
> regression test scans for them (`src/lib/t-096-portal-default-config.test.ts`).

## 9. Forbidden in this repository

- Any financial write path (the portal is read-mostly by design).
- Restoring or extending mock-auth in any form.
- Editing or applying `supabase/migrations/*` (hub-owned, ADR-001). The 4 portal patches were REMOVED from this repo in T-048 (2026-08-31) — never restore them.
- Duplicating or forking hub Edge Functions.
- Disabling type-checking/lint/tests to ship.
- Creating documentation or task lists here — everything belongs in the hub (ADR-007). This file is the only documentation this repo carries.
- History rewrites of any kind.
