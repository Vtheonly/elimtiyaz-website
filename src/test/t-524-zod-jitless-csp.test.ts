/**
 * T-524 / SEC-116 regression — Zod declared jitless (the CSP-eval console
 * violation).
 *
 * THE DEFECT (owner report, 2026-10-13, pasted alongside the sign-in failure):
 * Firefox's console shows
 *   "Content Security Policy of your site blocks the use of 'eval' in
 *    JavaScript"
 * on every fresh portal page load. Root cause (live chunk-graph forensics):
 * Zod 4.4.3's `$ZodObjectJIT` fast path probes `Function("")` at
 * schema-DEFINITION time to decide whether code generation is allowed. This
 * repo's CSP (src/middleware.ts, unchanged since the first commit) ships
 * `script-src 'self' 'unsafe-inline'` — deliberately WITHOUT 'unsafe-eval' —
 * so the probe throws a CSP violation in EVERY browser before Zod's catch
 * falls back to the interpreted parser. Functionality was never affected
 * (Zod's fallback is complete and behaviour-identical); the cost was a
 * scary-looking console error on every page load — and the owner debugs by
 * pasting console output, so a permanent benign violation generates recurring
 * false alarms during real investigations (this session's auth debugging
 * being the exact case).
 *
 * THE FIX (T-524 / SEC-116, 2026-10-13): declare the eval-free posture to
 * Zod up front — `z.config({ jitless: true })` in BOTH Zod-consumer modules,
 * before any schema is defined. Zod's own probe short-circuits on
 * `jitless` FIRST, so `Function("")` never executes: same interpreted
 * execution path Zod was already falling back to, zero console noise. The
 * CSP stays strict — we align the library to the policy, never weaken the
 * policy to the library (adding 'unsafe-eval' would be a real security
 * downgrade to silence a warning).
 *
 * These tests pin the behaviours that must hold:
 *   1. Importing either Zod-consumer module leaves Zod's global config
 *      `jitless: true` (the declaration actually runs).
 *   2. In BOTH consumer files the `z.config({ jitless: true })` call appears
 *      BEFORE the first `z.object(` definition (ordering is the whole point —
 *      a call after schema definition would let the probe fire first).
 *   3. The Zod consumer census is complete: src/lib/env.ts and
 *      src/lib/validation.ts are the ONLY files importing Zod. A new consumer
 *      failing this test must add the same declaration (or extend the census
 *      with a rationale).
 *   4. Validation semantics are UNCHANGED under jitless execution — the same
 *      safeParse success/failure shapes and dictionary-key messages.
 *   5. The CSP itself KEEPS excluding 'unsafe-eval' (this change aligns the
 *      runtime to the strict policy; it must never be used as a reason to
 *      relax the policy).
 *
 * Related: src/middleware.ts (the CSP) · hub `docs/recovery/problem-registry.md`
 * SEC-116 · the live evidence chain (runbook §6 probe, AUTH-401 — the actual
 * sign-in blocker is the Supabase-side Google client secret, NOT this CSP
 * warning).
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ZOD_CONSUMERS = ["src/lib/env.ts", "src/lib/validation.ts"] as const;

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

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 3; i++) {
    try {
      statSync(path.join(dir, "src/lib/env.ts"));
      return dir;
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error(`repo root not found from ${process.cwd()}`);
}

function* walkSources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      yield* walkSources(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

describe("T-524 / SEC-116 — Zod declared jitless (CSP-eval console violation)", () => {
  it("importing the env module leaves Zod's global config jitless:true (the declaration runs before any schema)", async () => {
    vi.resetModules();
    const { z } = await import("zod");
    // Before the consumer module evaluates, the flag is whatever the ambient
    // default is (unset) — importing env.ts must flip it.
    await import("../lib/env");
    expect(z.config().jitless).toBe(true);
  });

  it("importing the validation module leaves Zod's global config jitless:true (idempotent with env.ts)", async () => {
    vi.resetModules();
    const { z } = await import("zod");
    await import("../lib/validation");
    expect(z.config().jitless).toBe(true);
  });

  it("both consumer files call z.config({ jitless: true }) BEFORE the first schema definition (ordering pin)", () => {
    // The real schema-start shape is `z.object(` possibly split across lines
    // (`z\n  .object(`) — match it as a regex so comment prose never
    // satisfies the pin.
    const schemaStart = /z\s*\.\s*object\s*\(/;
    for (const file of ZOD_CONSUMERS) {
      const source = readSource(file);
      const callIndex = source.indexOf("z.config({ jitless: true })");
      const firstSchemaMatch = schemaStart.exec(source);
      expect(callIndex, `${file}: the z.config({ jitless: true }) call is missing`).toBeGreaterThanOrEqual(0);
      expect(
        firstSchemaMatch,
        `${file}: no schema definition found — census/convention drifted, revisit this suite`
      ).not.toBeNull();
      expect(
        callIndex,
        `${file}: the jitless declaration must precede the first z.object( (Zod probes Function(\"\") at schema-definition time)`
      ).toBeLessThan(firstSchemaMatch!.index);
    }
  });

  it("the Zod consumer census is complete — env.ts and validation.ts are the ONLY importers (a new consumer must carry the same declaration)", () => {
    const importers: string[] = [];
    const root = repoRoot();
    for (const full of walkSources(path.join(root, "src"))) {
      const source = readFileSync(full, "utf8");
      if (/from\s+["']zod(\/[\w./-]*)?["']/.test(source)) {
        importers.push(path.relative(root, full).replace(/\\/g, "/"));
      }
    }
    expect(importers.sort()).toEqual([...ZOD_CONSUMERS]);
  });

  it("validation semantics are UNCHANGED under jitless execution (same success/failure shapes, dictionary-key messages)", async () => {
    vi.resetModules();
    const { chatMessageSchema, absenceJustificationSchema } = await import("../lib/validation");

    // Success shape.
    const ok = chatMessageSchema.safeParse({ body: "  bonjour  ", channelId: "1b671a64-40d5-491e-99b0-da01ff1f3341" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.body).toBe("bonjour"); // .trim() still applied

    // Failure shape + the dictionary-key message contract (T-385 seam).
    const empty = chatMessageSchema.safeParse({ body: "   ", channelId: "1b671a64-40d5-491e-99b0-da01ff1f3341" });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0].message).toBe("validation.message.empty");
    }

    // The refinement chain (absence requiredness) still runs.
    const none = absenceJustificationSchema.safeParse({ note: "", driveLink: "", hasFile: false });
    expect(none.success).toBe(false);
    if (!none.success) {
      expect(none.error.issues.some((i) => i.message === "validation.absence.required")).toBe(true);
    }

    const withNote = absenceJustificationSchema.safeParse({ note: "excuse", driveLink: "", hasFile: false });
    expect(withNote.success).toBe(true);
  });

  it("the CSP itself KEEPS excluding 'unsafe-eval' — the runtime was aligned to the strict policy, never the policy relaxed", () => {
    const middleware = readSource("src/middleware.ts");
    // Pin the actual directive literal — the file's comments legitimately
    // MENTION 'unsafe-eval' while documenting why it is excluded, so pin the
    // policy string, not the prose.
    const scriptSrcLine = middleware
      .split("\n")
      .find((line) => line.trim().startsWith('"script-src'));
    expect(scriptSrcLine, "the script-src directive literal not found in src/middleware.ts").toBeDefined();
    expect(scriptSrcLine).toContain("'self'");
    expect(scriptSrcLine).toContain("'unsafe-inline'");
    expect(scriptSrcLine).not.toContain("unsafe-eval");
  });
});
