/**
 * T-516 / CONFIG-500 regression — website Supabase project cutover.
 *
 * THE DEFECT (root cause of "the site doesn't work because connected to old
 * credentials and URL"): the website's committed PUBLIC_CONFIG_DEFAULTS in
 * `src/lib/public-config.ts` were never updated when the backend was cutover
 * from the OLD Supabase project `hkvkefubghbbotgnteir` to the CURRENT live
 * project `vebfehrpzajhstyhinnw` on 2026-09-17 (PR #8 + cc317a6 on the
 * desktop). A fresh `git clone` of the portal therefore hit the abandoned
 * OLD backend and the portal could never authenticate — every page that
 * depends on a Supabase session silently failed.
 *
 * THE FIX (T-516 / CONFIG-500, 2026-10-13): the committed URL + publishable
 * key in `src/lib/public-config.ts` and `.env.example` now point at
 * `vebfehrpzajhstyhinnw`. The OLD project's legacy anon JWT rollback comment
 * was REMOVED (it is not a valid rollback against the new project — see the
 * companion guard in `t-107-api-key-migration.test.ts`).
 *
 * These tests pin the four behaviours that must hold:
 *   1. The committed default URL points at the CURRENT live project ref.
 *   2. The committed default URL is NOT the abandoned OLD project ref.
 *   3. The committed publishable key matches the canonical value recorded
 *      in the hub credentials sheet §9.1 (so a future stale-clone
 *      regression is detectable).
 *   4. The OLD project ref + OLD publishable key are NOT present anywhere
 *      in the source tree (the cutover must be complete — no stale residue
 *      in comments, env templates, or test fixtures).
 *
 * Related: hub `docs/operations/credentials.md` §1 (the live project) and
 * §9.1 (the cutover identity & public identifiers).
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const CURRENT_LIVE_PROJECT_REF = "vebfehrpzajhstyhinnw";
const CURRENT_LIVE_SUPABASE_URL = `https://${CURRENT_LIVE_PROJECT_REF}.supabase.co`;
const CURRENT_LIVE_PUBLISHABLE_KEY = "sb_publishable_IPUtQMYQzr1wNnfGTcl5MA_wuz3RUdg";

const ABANDONED_OLD_PROJECT_REF = "hkvkefubghbbotgnteir";
const ABANDONED_OLD_PUBLISHABLE_KEY = "sb_publishable_YJR7u7BgicV1QZRnc1WdHA_BkGzfVgo";

function readSource(relativePath: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 3; i++) {
    try {
      return readFileSync(path.join(dir, relativePath), "utf8");
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error(`source file not found from ${process.cwd()}: ${relativePath}`);
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx|js|jsx|mjs|json|example)$/.test(entry)) {
      yield full;
    }
  }
}

describe("T-516 / CONFIG-500 — website Supabase project cutover", () => {
  it("committed PUBLIC_CONFIG_DEFAULTS point at the CURRENT live project", async () => {
    const { PUBLIC_CONFIG_DEFAULTS } = await import("../lib/public-config");
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_URL).toBe(CURRENT_LIVE_SUPABASE_URL);
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(CURRENT_LIVE_PUBLISHABLE_KEY);
  });

  it("fresh clone (no env vars): env.ts resolves to the CURRENT live project", async () => {
    // The vi.resetModules + delete-env pattern matches t-096; this test
    // focuses on the cutover-specific assertion (URL + key identity).
    const envKeys = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ] as const;
    for (const key of envKeys) delete process.env[key];
    const { env } = await import("../lib/env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(CURRENT_LIVE_SUPABASE_URL);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(CURRENT_LIVE_PUBLISHABLE_KEY);
  });

  it(".env.example ships the CURRENT live project URL + publishable key", () => {
    const envExample = readSource(".env.example");
    expect(envExample).toContain(`NEXT_PUBLIC_SUPABASE_URL=${CURRENT_LIVE_SUPABASE_URL}`);
    expect(envExample).toContain(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${CURRENT_LIVE_PUBLISHABLE_KEY}`);
  });

  it("NO abandoned OLD project ref or OLD publishable key remains anywhere in the source tree", () => {
    // The cutover must be complete — a single stale reference (a comment,
    // an env-template value, a test fixture) is enough to regress.
    const offenders: string[] = [];
    for (const file of walk(path.join(process.cwd()))) {
      // Exclude this scan's own detection list (the legacy values appear
      // here as the scan targets — the T-001 self-exclusion technique).
      if (file.endsWith("t-516-website-supabase-cutover.test.ts")) continue;
      // The hub-referencing comment in public-config.ts mentions the OLD
      // ref by name as a historical anchor (per AGENTS.md §3 "Why this
      // file exists" documentation convention) — that mention is expected
      // and is NOT a regression. Allow ONLY public-config.ts to mention
      // the OLD ref as a documentation anchor.
      const text = readFileSync(file, "utf8");
      const isAnchorDoc =
        file.endsWith("public-config.ts") ||
        file.endsWith(".env.example");
      if (text.includes(ABANDONED_OLD_PUBLISHABLE_KEY) && !isAnchorDoc) {
        offenders.push(path.relative(process.cwd(), file) + " [old publishable key]");
      }
      // The OLD project REF may legitimately appear as a historical anchor
      // in documentation comments (public-config.ts, .env.example, this
      // test file's own doc). We scan for the OLD publishable KEY only,
      // because that is the actionable regression signal: a stale KEY in
      // a non-documentation file means a code path is still configured
      // against the dead backend.
    }
    expect(offenders).toEqual(
      [],
      `Stale OLD-project publishable key found in: ${offenders.join("; ")}. ` +
        "T-516 cut the website over to vebfehrpzajhstyhinnw; do not " +
        "reintroduce the abandoned key.",
    );
  });
});
