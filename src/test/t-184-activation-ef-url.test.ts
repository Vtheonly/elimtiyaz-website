/**
 * T-184 regression tests — the activation screen must build the Edge
 * Function URL through `@/lib/env` (ACT-201's portal half).
 *
 * The defect (owner-reported 2026-09-05, production Vercel console):
 *   `/undefined/functions/v1/bind-activation-code` → 404.
 *
 * `activation-code-screen.tsx` read
 * `process.env.NEXT_PUBLIC_SUPABASE_URL` DIRECTLY inside a client
 * component. Next.js inlines NEXT_PUBLIC_* values at BUILD time; on a
 * deployment host that has not set them, the inlined value is `undefined`,
 * so the fetch targeted the PORTAL origin (`/undefined/functions/v1/…`)
 * and 404'd on EVERY activation attempt — no matter how valid the code.
 * The live EF itself was healthy (anon probe 2026-09-05: POST → 401
 * structured `{"error":{"code":"unauthorized"}}`, OPTIONS → 200).
 *
 * These tests pin:
 *   1. NO client component reads `process.env.NEXT_PUBLIC_SUPABASE_*`
 *      directly (the whole src tree — this bug class, not just this file).
 *   2. The screen resolves the URL + apikey through `env` from `@/lib/env`
 *      (the T-096 fallback chain: build-time env vars → committed
 *      PUBLIC_CONFIG_DEFAULTS).
 *   3. The fresh-clone guarantee that production relied on: with NO env
 *      vars set, `env.NEXT_PUBLIC_SUPABASE_URL` equals the committed
 *      default — never undefined, never a relative path.
 *   4. The built EF URL is well-formed and points at the shared Supabase
 *      project (https://<ref>.supabase.co/functions/v1/…).
 *   5. The T-153 contract is preserved: the screen still maps structured
 *      errors via `mapActivationError(data)` (no direct data.error regex).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

const SCREEN = readFileSync(join(SRC, "features/auth/activation-code-screen.tsx"), "utf8");

describe("T-184 — activation EF URL resolves through env (ACT-201)", () => {
  it("the activation screen never reads process.env.NEXT_PUBLIC_SUPABASE_* directly", () => {
    expect(SCREEN).not.toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(SCREEN).not.toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("the activation screen imports env from @/lib/env", () => {
    expect(SCREEN).toMatch(/import\s*\{\s*env\s*\}\s*from\s*"@\/lib\/env"/);
  });

  it("the EF URL is built from env.NEXT_PUBLIC_SUPABASE_URL (fallback chain applies)", () => {
    expect(SCREEN).toContain("${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bind-activation-code");
    expect(SCREEN).toContain("apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("no OTHER client file reads process.env.NEXT_PUBLIC_* at runtime (whole-src scan)", () => {
    // env.ts is the single sanctioned reader (it applies the T-096 fallback
    // chain); the t-121/t-096 tests legitimately manipulate process.env in
    // test code. Everything else must import from @/lib/env. The regex
    // requires an identifier character after NEXT_PUBLIC_ so doc comments
    // like "reads process.env.NEXT_PUBLIC_* FIRST" (public-config.ts) are
    // not false-positived.
    const offenders: string[] = [];
    const readPattern = /process\.env\.NEXT_PUBLIC_[A-Za-z0-9_]+/;
    const walk = (dir: string): void => {
      for (const entry of readdirSyncSafe(dir)) {
        const full = join(dir, entry.name ?? entry);
        if (entry.isDirectory?.() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name ?? "") && !entry.name.includes(".test.")) {
          const text = readFileSync(full, "utf8");
          if (readPattern.test(text)) {
            offenders.push(relativePath(full));
          }
        }
      }
    };
    walk(SRC);
    // The ONLY sanctioned direct reader is src/lib/env.ts.
    expect(offenders).toEqual(["src/lib/env.ts"]);
  });

  it("fresh-clone guarantee: env falls back to the committed default (never undefined)", async () => {
    // Import the REAL env module with no NEXT_PUBLIC_* vars set in this
    // process — the exact production scenario that 404'd (Vercel project
    // without the env vars configured). jsdom test env: process.env carries
    // no NEXT_PUBLIC_SUPABASE_URL, so the PUBLIC_CONFIG_DEFAULTS must win.
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { env } = await import("@/lib/env");
    const { PUBLIC_CONFIG_DEFAULTS } = await import("@/lib/public-config");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_URL);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  });

  it("the EF URL built from the fallback is well-formed (no undefined segment, shared project)", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { env } = await import("@/lib/env");
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bind-activation-code`;
    expect(url).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/bind-activation-code$/);
    expect(url).not.toContain("undefined");
  });

  it("T-153 contract preserved: structured errors still map via mapActivationError(data)", () => {
    expect(SCREEN).toContain("mapActivationError(data)");
    expect(SCREEN).not.toContain("data?.error ??");
  });
});

// ── helpers ────────────────────────────────────────────────────────────────
import { readdirSync } from "node:fs";

type DirEntry = { name: string; isDirectory: () => boolean };

function readdirSyncSafe(dir: string): DirEntry[] {
  return readdirSync(dir, { withFileTypes: true }) as unknown as DirEntry[];
}

function relativePath(full: string): string {
  const marker = "src/";
  const idx = full.indexOf(marker);
  return idx >= 0 ? full.slice(idx) : full;
}
