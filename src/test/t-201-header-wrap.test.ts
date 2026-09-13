/**
 * T-201 regression tests — page header rows must wrap on narrow screens
 * (UI-302: title + action-button clusters pushing the page wide).
 *
 * The defect (live-measured 2026-09-06, 31st session, at 320px viewport):
 *   four surfaces shared one pattern — `flex items-center justify-between
 *   gap-3` holding an h1/CardTitle plus an action cluster (Button and/or
 *   StudentSwitcherDropdown) whose combined min-content width exceeded the
 *   288px available at 320px. With no `flex-wrap`, the row pushed the
 *   document wide: finance 163px, academic 77px, notifications 39px,
 *   profile documents card 42px of horizontal page overflow.
 *
 * These tests pin the fix class on all four surfaces:
 *   1. Each header row carries `flex-wrap` + a `gap-y-*` (the stacked
 *      state gets intentional spacing, not a cramped 0 gap).
 *   2. Each h1/CardTitle carries `min-w-0` (allows the flex item to
 *      shrink below content so wrapping actually engages).
 *
 * Scope note: this is a per-file pin of the four MEASURED offenders, not a
 * whole-src heuristic — the t-199 whole-src scan already guards the grid
 * family, and a generic "all headers must wrap" rule would false-positive
 * on short single-action rows that genuinely fit.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

const SURFACES: Array<{ file: string; headerProbe: RegExp; titleProbe: RegExp | null }> = [
  {
    file: "features/financial/financial-view.tsx",
    headerProbe: /flex flex-wrap items-center justify-between gap-x-3 gap-y-2/,
    titleProbe: /h1 className="min-w-0 text-xl font-semibold"/,
  },
  {
    file: "features/academic/academic-view.tsx",
    headerProbe: /flex flex-wrap items-center justify-between gap-x-3 gap-y-2/,
    titleProbe: /h1 className="min-w-0 text-xl font-semibold"/,
  },
  {
    file: "features/notifications/notifications-view.tsx",
    headerProbe: /flex flex-wrap items-center justify-between gap-x-3 gap-y-2/,
    titleProbe: /h1 className="min-w-0 text-xl font-semibold"/,
  },
  {
    file: "features/profile/student-documents-card.tsx",
    headerProbe: /flex flex-wrap items-center justify-between gap-x-2 gap-y-2/,
    titleProbe: null,
  },
];

describe("T-201 — page header rows wrap on narrow screens (UI-302)", () => {
  for (const surface of SURFACES) {
    it(`${surface.file}: the header row wraps (flex-wrap + gap-y)`, () => {
      const source = read(surface.file);
      expect(source).toMatch(surface.headerProbe);
      if (surface.titleProbe) {
        expect(source).toMatch(surface.titleProbe);
      }
    });
  }

  it("the four surfaces no longer declare the non-wrapping header pattern", () => {
    // The exact pre-fix class string must be gone from all four files.
    // (Other views may still legitimately use the pattern when their rows
    // are measured to fit — this pin is scoped to the measured offenders.)
    for (const surface of SURFACES) {
      const source = read(surface.file);
      expect(source).not.toMatch(
        /className="flex items-center justify-between gap-3"/,
      );
    }
  });
});
