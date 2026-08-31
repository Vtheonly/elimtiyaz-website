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
 *  3. the legacy anon JWT survives ONLY as the documented rollback value in
 *     public-config.ts (so a future cleanup cannot silently drop the
 *     rollback while the legacy keys are still active);
 *  4. env.ts's placeholder detection does NOT reject the publishable format
 *     (an `sb_publishable_…` value must classify as configured).
 *
 * Both keys were live-verified 2026-09-01 against
 * hkvkefubghbbotgnteir.supabase.co (auth/health 200, REST query processed,
 * password grant 200) — see docs/operations/credentials.md in the hub repo.
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
const LEGACY_JWT =
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

  it("legacy anon JWT exists ONLY as the public-config.ts rollback comment", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(process.cwd(), "src"))) {
      // Exclude this scan's own detection list (T-001 technique) and the
      // sanctioned rollback comment location.
      if (file.endsWith("t-107-api-key-migration.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes(LEGACY_JWT) && !file.endsWith("public-config.ts")) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
    // …and the rollback comment is still present while legacy keys are active.
    expect(readSource("src/lib/public-config.ts")).toContain(LEGACY_JWT);
  });

  it("placeholder detection accepts the publishable format (configured state)", async () => {
    const mod = await import("../lib/env");
    // The module-level parse uses the committed defaults when no env vars are
    // set — with the publishable default this MUST resolve to configured.
    expect(mod.isSupabaseConfigured).toBe(true);
  });
});
