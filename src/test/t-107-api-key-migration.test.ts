import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * T-107 / MIG-KEYS-201 — new-format Supabase API key migration guards.
 *
 * The committed public identifier is now the `sb_publishable_…` key
 * (ADR-009: dual acceptance, publishable-preferred). These guards pin:
 *  1. the committed default IS the publishable key (not the legacy JWT);
 *  2. `.env.example` ships the same publishable value;
 *  3. NO legacy anon JWT is committed anywhere in the source tree
 *     (the OLD project's legacy JWT was removed in T-516 / CONFIG-500,
 *     2026-10-13 — it was project-scoped to the abandoned
 *     `hkvkefubghbbotgnteir` project and is NOT a valid rollback against
 *     the current live `vebfehrpzajhstyhinnw` project; a NEW legacy anon
 *     JWT for the new project exists only in the Supabase dashboard and
 *     must NEVER be committed to any client repo);
 *  4. env.ts's placeholder detection does NOT reject the publishable format
 *     (an `sb_publishable_…` value must classify as configured).
 *
 * The publishable key was live-verified against
 * vebfehrpzajhstyhinnw.supabase.co (the current live project since the
 * 2026-09-17 switch) — see docs/operations/credentials.md in the hub repo.
 */

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
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
      yield full;
    }
  }
}

const PUBLISHABLE_PREFIX = "sb_publishable_";
// T-516 / CONFIG-500 (2026-10-13): the legacy anon JWT was project-scoped
// to the OLD `hkvkefubghbbotgnteir` project and was REMOVED from this repo
// when the committed defaults were cutover to the live
// `vebfehrpzajhstyhinnw` project. The OLD JWT value (recorded below) is
// kept ONLY as the scan target so the guard can prove it is no longer
// committed anywhere in the source tree. A NEW legacy anon JWT for the
// current project exists in the Supabase dashboard (Settings → API Keys)
// and remains dual-accepted per ADR-009 — agents who need a rollback
// value retrieve it from the dashboard, never from a client repo.
const LEGACY_JWT_OLD_PROJECT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrdmtlZnViZ2hiYm90Z250ZWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDQ2ODQsImV4cCI6MjEwMDU4MDY4NH0.GDQiKjp4YBbCpsgoJXeSUqUT8Ag67He2fmngy6NNPmk";

describe("T-107 / MIG-KEYS-201 — publishable-key migration", () => {
  it("committed default is the publishable key, not the legacy anon JWT", async () => {
    const { PUBLIC_CONFIG_DEFAULTS } = await import("../lib/public-config");
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_ANON_KEY).toMatch(
      /^sb_publishable_[A-Za-z0-9_-]+$/
    );
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_ANON_KEY).not.toContain("eyJ");
  });

  it(".env.example ships the publishable key in NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    const envExample = readSource(".env.example");
    const line = envExample
      .split("\n")
      .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY="));
    expect(line).toBeDefined();
    expect(line!.split("=")[1]).toMatch(/^sb_publishable_[A-Za-z0-9_-]+$/);
  });

  it("NO legacy anon JWT for the OLD project remains committed anywhere in src/ (T-516 cleanup guard)", () => {
    // T-516 / CONFIG-500 (2026-10-13): the previous behaviour (T-107 v1)
    // asserted the legacy JWT WAS present in public-config.ts as a rollback
    // comment. That rollback was project-scoped to the abandoned
    // `hkvkefubghbbotgnteir` project — it does NOT validate against the
    // current live `vebfehrpzajhstyhinnw` project, so keeping it would have
    // been a misleading “rollback” that fails the moment it is exercised.
    // The cutover REMOVED it; this guard proves the removal is durable.
    const offenders: string[] = [];
    for (const file of walk(path.join(process.cwd(), "src"))) {
      // Exclude this scan's own detection list (T-001 technique).
      if (file.endsWith("t-107-api-key-migration.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes(LEGACY_JWT_OLD_PROJECT)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual(
      [],
      `Legacy OLD-project anon JWT found in: ${offenders.join(", ")}. ` +
        "T-516 removed it; do not reintroduce — it is not a valid rollback " +
        "against the current live project.",
    );
    // Also assert the rollback comment block is GONE from public-config.ts
    // (the previous T-107 v1 guard asserted it WAS present — the inverse now).
    const publicConfig = readSource("src/lib/public-config.ts");
    expect(publicConfig).not.toContain(LEGACY_JWT_OLD_PROJECT);
    expect(publicConfig).not.toMatch(/Legacy anon JWT \(still valid, rollback value\):/);
  });

  it("placeholder detection accepts the publishable format (configured state)", async () => {
    const mod = await import("../lib/env");
    // The module-level parse uses the committed defaults when no env vars are
    // set — with the publishable default this MUST resolve to configured.
    expect(mod.isSupabaseConfigured).toBe(true);
  });
});
