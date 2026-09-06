/**
 * T-200 regression tests — KpiCard values must fit their card on mobile
 * (UI-301: unbreakable Intl currency strings at text-2xl).
 *
 * The defect (live-measured 2026-09-06, 31st session):
 *   formatCurrency's fr-XX Intl output groups digits with U+202F NARROW
 *   NO-BREAK SPACE ("175 000,00 DA") — a single unbreakable token. Rendered
 *   at font-mono text-2xl inside a half-width mobile KPI card
 *   (~85px of value column after padding + icon), the token poked out of
 *   the card and the page: 108px of document overflow on the finance view
 *   at 375px; 23px of clipping even at desktop 4-col width.
 *
 * These tests pin:
 *   1. The value element carries `break-words` (overflow-wrap: break-word —
 *      the emergency-break safety net for unbreakable currency tokens).
 *   2. The value steps down one size below sm (text-xl … sm:text-2xl) so
 *      typical DZD amounts fit without wrapping.
 *   3. The decorative icon block is hidden below sm (`hidden … sm:block`) —
 *      it consumed ~48px of the value's column on mobile.
 *   4. The formatter contract is UNTOUCHED: formatCurrency still emits the
 *      narrow-no-break group separators (parity with the pinned
 *      format.test.ts expectations and the cross-platform corpus) — the
 *      fix is display-layer only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCurrency } from "@/lib/format";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");
const KPICARD = readFileSync(
  join(SRC, "features/shared/kpi-card.tsx"),
  "utf8",
);

describe("T-200 — KpiCard values fit on mobile (UI-301)", () => {
  it("the value element has the break-words safety net", () => {
    expect(KPICARD).toMatch(/break-words/);
  });

  it("the value size steps down below sm", () => {
    expect(KPICARD).toMatch(/text-xl[^\n]*sm:text-2xl/);
  });

  it("the decorative icon block is hidden below sm", () => {
    // The icon wrapper must not consume the value's column on mobile.
    expect(KPICARD).toMatch(/hidden[^\n]*sm:block/);
    expect(KPICARD).not.toMatch(/shrink-0 rounded-lg bg-muted\/50 p-2"/);
  });

  it("formatCurrency still emits narrow-no-break group separators (parity preserved)", () => {
    // The formatter is parity-pinned (format.test.ts + cross-platform
    // corpus); the T-200 fix must be display-layer only. If this ever
    // fails, someone changed the FORMATTER instead of the display.
    // Actual Intl output shape (Node 20+/ICU): "175 000,00 DA" where the
    // digit-group separator is U+202F (narrow no-break space) and the
    // pre-currency separator is U+00A0 (no-break space).
    const out = formatCurrency(175000);
    expect(out).toContain("\u202f");
    expect(out).toContain("\u00a0DA");
    expect(out.replace(/[\u202f\u00a0]/g, " ")).toBe("175 000,00 DA");
  });
});
