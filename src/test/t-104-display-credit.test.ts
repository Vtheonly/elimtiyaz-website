import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { displayCredit } from "../lib/canonical/portal-derive";

/**
 * T-104 / ADR-010 — display-level parent-credit derivation (DATA-009),
 * website port of the desktop's `displayParentCredit`
 * (elimtiyaz-desktop/src/domain/calc/ledger/balance.ts — verbatim port per
 * AGENTS.md §9). The desktop suite pins the same vectors at the source.
 */
describe("displayCredit — ADR-010 display derivation (T-104)", () => {
  it("DATA-009 canonical overpayment: −100k balance, −50k booked credit → 50k (NOT the double-counted 100k)", () => {
    expect(displayCredit(-100_000, -50_000)).toBe(50_000);
  });

  it("historical overpayer (0062 reconciliation, no credit entries): −50k balance → 50k", () => {
    expect(displayCredit(-50_000, 0)).toBe(50_000);
  });

  it("normal debtor: positive balance → 0 (even with absorbed goodwill credit)", () => {
    expect(displayCredit(30_000, 0)).toBe(0);
    expect(displayCredit(50_000, -50_000)).toBe(0);
  });

  it("standalone goodwill credit (no charge yet): −50k balance, −50k credit → 50k", () => {
    expect(displayCredit(-50_000, -50_000)).toBe(50_000);
  });

  it("zero balances → 0", () => {
    expect(displayCredit(0, 0)).toBe(0);
    expect(displayCredit(0, -1_000)).toBe(0);
  });

  it("financial-view KPI consumes the derivation (source-scan guard)", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/features/financial/financial-view.tsx"),
      "utf8",
    );
    expect(src).toContain("displayCredit(balance.outstanding, balance.unallocatedCredit)");
    expect(src).not.toContain("Math.abs(balance.unallocatedCredit)");
  });
});
