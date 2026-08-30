/**
 * Regression tests for T-035 — website financial KPI correctness.
 *
 * WEAK-022: `useLedgerEntries` used to hard-cap the fetch at 500 rows.
 * The portal's balance is a LEDGER REPLAY (INV-1: balances are NEVER
 * stored, always replayed) — replaying only the OLDEST 500 entries drops
 * the most recent ones, so a parent with > 500 entries saw an inflated
 * outstanding balance on the portal while the desktop's canonical
 * `compute_parent_summary` SQL RPC replays the entire ledger.
 *
 * Fix: `fetchAllLedgerEntries` pages with `.range()` (page size 1000)
 * until a short page; the dashboard + financial views no longer pass a
 * hard cap. The pure helper is tested here with a fake PostgREST surface
 * (eq/order/range/limit/then) that serves the fixture in pages.
 *
 * WEAK-018 (the other T-035 item) was found ALREADY FIXED in the sources
 * — dashboard-view calls the canonical `installmentRemainingAmount` (no
 * inline `amount_due - amount_paid` formula survives) — that fix landed
 * with the session-8 portal restructure while the registry entry stayed
 * OPEN; the registry is updated by this task with this evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchAllLedgerEntries } from "./portal-queries";

const SRC = join(process.cwd(), "src");

// ============================================================================
// Fake client — serves pages of `ledger_entries` over the builder surface
// the helper uses (select/eq/order/range/limit/then).
// ============================================================================

type Row = Record<string, unknown>;

// The fake's then() must apply the recorded range — wrap it.
class RangeAwareQuery {
  constructor(
    private readonly all: Row[],
    private readonly ranges: number[][],
  ) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  range(from: number, to: number) {
    this.ranges.push([from, to]);
    return this;
  }
  then<TResult1>(
    onFulfilled:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): Promise<TResult1> {
    const [from, to] = this.ranges[this.ranges.length - 1] ?? [0, this.all.length - 1];
    return Promise.resolve({
      data: this.all.slice(from, to + 1),
      error: null,
    }).then(onFulfilled!);
  }
}

class RangeAwareClient {
  ranges: number[][] = [];
  constructor(private readonly rows: Row[]) {}
  from(table: string) {
    if (table !== "ledger_entries") throw new Error(`unexpected table ${table}`);
    return new RangeAwareQuery(this.rows, this.ranges);
  }
}

function makeEntries(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `led-${i + 1}`,
    parent_id: "p1",
    amount: i % 2 === 0 ? 1000 : -1000,
    at: new Date(Date.UTC(2025, 0, 1, 0, 0, i)).toISOString(),
  }));
}

const PARENT = "p1";

describe("T-035 / WEAK-022 — full-ledger paging", () => {
  it("fetches across MULTIPLE pages until a short page (1500 rows → 2 requests)", async () => {
    const rows = makeEntries(1500);
    const client = new RangeAwareClient(rows);
    const result = await fetchAllLedgerEntries(
      client as never,
      PARENT,
    );
    expect(result.length).toBe(1500); // the old hook stopped at 500
    expect(client.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("stops after ONE request when everything fits on the first page (600 rows)", async () => {
    const rows = makeEntries(600);
    const client = new RangeAwareClient(rows);
    const result = await fetchAllLedgerEntries(client as never, PARENT);
    expect(result.length).toBe(600);
    expect(client.ranges).toEqual([[0, 999]]);
  });

  it("returns rows in arrival order (at ASC preserved across pages)", async () => {
    const rows = makeEntries(1200);
    const client = new RangeAwareClient(rows);
    const result = await fetchAllLedgerEntries(client as never, PARENT);
    expect(result[0].id).toBe("led-1");
    expect(result[1099].id).toBe("led-1100");
    expect(result[1199].id).toBe("led-1200");
  });

  it("no hard-coded 500 cap remains at the dashboard / financial call sites", () => {
    const dashboard = readFileSync(
      join(SRC, "features/dashboard/dashboard-view.tsx"),
      "utf-8",
    );
    const financial = readFileSync(
      join(SRC, "features/financial/financial-view.tsx"),
      "utf-8",
    );
    expect(dashboard).not.toContain("limit: 500");
    expect(financial).not.toContain("limit: 500");
    // And the hook really pages (the fix is wired, not just the call sites).
    const queries = readFileSync(join(SRC, "lib/hooks/portal-queries.ts"), "utf-8");
    expect(queries).toContain("fetchAllLedgerEntries");
    expect(queries).toContain(".range(from, from + PAGE_SIZE - 1)");
  });
});

describe("T-035 / WEAK-018 — the canonical remaining-amount KPI", () => {
  it("dashboard uses installmentRemainingAmount (no inline cleared-only formula)", () => {
    const dashboard = readFileSync(
      join(SRC, "features/dashboard/dashboard-view.tsx"),
      "utf-8",
    );
    expect(dashboard).toContain("installmentRemainingAmount(nextInstallment)");
    // The old inline formula ignored amount_pending (cleared-only view).
    expect(dashboard).not.toMatch(/nextInstallment\.amount_due\s*-\s*nextInstallment\.amount_paid(?!_)/);
  });
});
