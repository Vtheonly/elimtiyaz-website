/**
 * T-057 — website canonical port honesty regression suite (DRIFT-009,
 * DEAD-011).
 *
 * Problem: the canonical engine port shipped ~26 files while the read-only
 * portal consumed ~6 functions; the calc/payment + calc/pricing subtrees
 * (13 files) plus entries/charges/model-pricing and the never-imported
 * index.ts barrel were dead weight — and every header promised a
 * `scripts/port-canonical.mjs` that never existed.
 *
 * Fixed: the port is pruned to the consumed surface (10 source files); the
 * headers now state the truth (verbatim port + source sha + a never-re-add
 * note); the lying script promise is gone.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CANONICAL = join(__dirname, "../canonical");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("T-057 — the canonical port is pruned to the consumed surface", () => {
  it("the dead subtrees stay gone (payment calc, pricing, entry factories, barrel)", () => {
    expect(existsSync(join(CANONICAL, "calc/payment"))).toBe(false);
    expect(existsSync(join(CANONICAL, "calc/pricing"))).toBe(false);
    expect(existsSync(join(CANONICAL, "calc/ledger/entries.ts"))).toBe(false);
    expect(existsSync(join(CANONICAL, "calc/ledger/charges.ts"))).toBe(false);
    expect(existsSync(join(CANONICAL, "model/pricing.ts"))).toBe(false);
    expect(existsSync(join(CANONICAL, "index.ts"))).toBe(false);
  });

  it("the kept surface is exactly the consumed set (11 source files + 2 tests)", () => {
    const files = walk(CANONICAL).map((f) => f.replace(CANONICAL + "/", "")).sort();
    expect(files).toEqual([
      "billing-breakdown.test.ts", // T-166: Facturation breakdown vectors (parity with the desktop suite)
      "billing-breakdown.ts",      // T-166: read-side itemized billing derivation (no pricing/waterfall port — ADR-002)
      "calc/ledger/account-id.ts", // kept: portal-derive.test exercises deriveAccountId
      "calc/ledger/balance.ts",    // computeParentSummary
      "calc/ledger/overdue.ts",    // buildOverdueDueDateMap
      "calc/shared/dates.ts",
      "calc/shared/money.ts",      // clampNonNegative
      "model/academic.ts",         // computeSubjectAverage/computeOverallGpa/calculateAttendanceRate
      "model/ledger.ts",
      "model/parent.ts",
      "model/payment.ts",
      "model/student.ts",
      "portal-derive.test.ts",
      "portal-derive.ts",
      "t-057-port-honesty.test.ts", // this file
    ]);
  });

  it("no header promises the non-existent port-canonical.mjs script (DEAD-011)", () => {
    for (const f of walk(CANONICAL).filter((f) => !f.endsWith(".test.ts"))) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toContain("re-run\n * scripts/port-canonical.mjs");
      expect(text, f).not.toMatch(/DO NOT edit by hand: re-run/);
    }
  });

  it("the kept headers state the verbatim-port source + the never-re-add note", () => {
    const text = readFileSync(join(CANONICAL, "calc/ledger/balance.ts"), "utf8");
    expect(text).toContain("verbatim port of the desktop canonical");
    expect(text).toContain("Source: elimtiyaz-desktop/src/domain/calc/ledger/balance.ts");
    expect(text).toContain("Source sha256");
    expect(text).toContain("never re-add them");
  });
});
