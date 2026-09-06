/**
 * T-199 regression tests — responsive grids must declare a base column
 * template (UI-300: the dashboard grid blowout).
 *
 * The defect (live-measured 2026-09-06, 31st session):
 *   `className="grid gap-6 lg:grid-cols-2"` (dashboard-view.tsx) sets NO
 *   grid-template-columns below the lg breakpoint. The implicit track is
 *   minmax(auto, auto) — it sizes to the item's MAX-CONTENT width, and the
 *   CardListItem `.truncate` only ellipsizes when the box is width-
 *   constrained (truncate does not constrain a grid track). Result: the
 *   full untruncated text width became the track width and the dashboard
 *   scrolled horizontally by 880px at 375px / 935px at 320px.
 *
 * These tests pin:
 *   1. The dashboard's two-column section carries `grid-cols-1` (the fix).
 *   2. NO file in src/ declares a static `className="…grid gap-…"` (or
 *      `gap-… … lg:grid-cols-…` variants) without a base `grid-cols-*`
 *      token in the SAME class attribute — the whole bug class, not just
 *      this file (the t-184 whole-src-scan pattern).
 *
 * Scope note: dynamic className strings built via cn() are NOT scanned —
 * the defect pattern (a static responsive-grid attribute missing its base
 * cols) is what this guard exists for; cn() callers compose tokens that
 * are already individually correct.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

const DASHBOARD = readFileSync(
  join(SRC, "features/dashboard/dashboard-view.tsx"),
  "utf8",
);

/** Recursively collect .tsx/.ts files under a root. */
function collectFiles(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) collectFiles(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * A static className attribute is a grid-without-base-cols defect when:
 *   - it contains the standalone `grid` utility (a grid container), AND
 *   - it contains a `gap-*` utility (a layout grid, not a decorative one), AND
 *   - it contains a RESPONSIVE grid-cols (sm:/md:/lg:/xl: grid-cols-…),
 *     meaning the author INTENDED responsive column switching, AND
 *   - it has NO base (non-prefixed) `grid-cols-` token.
 * A grid that never changes columns (`grid grid-cols-2 …`) is fine; a grid
 * that gains columns only at a breakpoint MUST carry its mobile template.
 */
const STATIC_ATTR = /className="([^"]*)"/g;
function isBareResponsiveGrid(cls: string): boolean {
  const tokens = cls.trim().split(/\s+/);
  const hasGrid = tokens.includes("grid");
  const hasGap = tokens.some((t) => /^gap(-|-x|-y)?-/.test(t));
  const hasResponsiveCols = tokens.some((t) =>
    /^(sm|md|lg|xl|2xl):grid-cols-/.test(t),
  );
  const hasBaseCols = tokens.some((t) => /^grid-cols-/.test(t));
  return hasGrid && hasGap && hasResponsiveCols && !hasBaseCols;
}

describe("T-199 — responsive grids declare a base column template (UI-300)", () => {
  it("the dashboard two-column section carries grid-cols-1", () => {
    expect(DASHBOARD).toContain(
      '"grid grid-cols-1 gap-6 lg:grid-cols-2"',
    );
  });

  it("no static className in src/ is a bare responsive grid (whole-src scan)", () => {
    const offenders: string[] = [];
    // NOTE: test files are excluded — THIS file documents the old broken
    // pattern in its docstring/comments, and other suites embed fixture
    // strings. The guard targets production component source only.
    const productionFiles = collectFiles(SRC).filter(
      (f) => !f.includes("/test/") && !f.endsWith(".test.ts"),
    );
    for (const file of productionFiles) {
      const source = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      STATIC_ATTR.lastIndex = 0;
      while ((m = STATIC_ATTR.exec(source)) !== null) {
        if (isBareResponsiveGrid(m[1])) {
          offenders.push(
            `${file.replace(SRC + "/", "")}: className="${m[1].slice(0, 80)}"`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
