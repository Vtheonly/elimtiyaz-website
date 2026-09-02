/**
 * T-126 regression tests — the portal carries NO local Edge Functions
 * except the grandfathered bind-activation-code (CROSS-009, blocked on
 * UNKNOWN-001).
 *
 * The defect (PUSH-100's source-control half): the send-push-notification
 * Edge Function was live-deployed on the Supabase project, but its ONLY
 * source lived in THIS repository — a drifted copy (WEAK-014's wrong
 * `user_profile_id` column filter + the false "invoked by a webhook"
 * header) — while the hub repo (the canonical Edge-Function owner per
 * ADR-001 and docs/operations/credentials.md) carried nothing. A future
 * deployment from the hub would have silently reverted the website-side
 * fixes, and the credentials sheet's "the canonical EF lives in the hub"
 * claim was false.
 *
 * The fix (T-126, 2026-09-02): the fixed, canonical source lives in the
 * hub at `elimtiyaz-desktop/supabase/functions/send-push-notification/`;
 * this repo's copy is DELETED. Schema changes AND Edge-Function changes
 * both belong to the hub repo (ADR-001).
 *
 * These tests pin:
 *   1. `supabase/functions/send-push-notification/` does not exist here.
 *   2. `supabase/migrations/` still does not exist here (T-048 guard).
 *   3. No portal source invokes the push EF directly (pushes are
 *      server-side only; the portal registers tokens via the canonical
 *      `register_fcm_token` RPC, never by calling the EF).
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const FUNCTIONS_DIR = resolve(REPO_ROOT, "supabase", "functions");

function listDirSafe(p: string): string[] {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

describe("T-126 — Edge Functions are hub-owned (no local EF drift)", () => {
  it("this repo carries NO send-push-notification Edge Function (hub owns it)", () => {
    expect(existsSync(resolve(FUNCTIONS_DIR, "send-push-notification"))).toBe(false);
  });

  it("this repo carries NO supabase/migrations directory (T-048 guard)", () => {
    expect(existsSync(resolve(REPO_ROOT, "supabase", "migrations"))).toBe(false);
  });

  it("the only local Edge Function (if any) is the grandfathered bind-activation-code", () => {
    const fns = listDirSafe(FUNCTIONS_DIR).filter((d) => !d.startsWith("_"));
    // CROSS-009 / UNKNOWN-001: bind-activation-code stays until the EF
    // consolidation decision is made. NOTHING else may appear here.
    expect(fns.every((f) => f === "bind-activation-code")).toBe(true);
  });

  it("no portal source invokes the push EF directly (server-side only)", () => {
    const srcDir = resolve(REPO_ROOT, "src");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
          const content = readFileSync(full, "utf8");
          if (
            content.includes("functions/v1/send-push-notification") ||
            content.includes('invoke("send-push-notification"')
          ) {
            offenders.push(full.replace(REPO_ROOT, ""));
          }
        }
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
