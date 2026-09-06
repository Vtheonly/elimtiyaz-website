/**
 * T-202 regression tests — the financial 5-tab bar must not clip its
 * labels at narrow widths (UI-303).
 *
 * The defect (live-measured 2026-09-06, 31st session, at 320px):
 *   `<TabsList className="grid w-full grid-cols-5">` — five equal
 *   minmax(0,1fr) cells (~54px each after the container's padding at
 *   320px) while the French labels need 58–84px ("Facturation" 65,
 *   "Paiements" 62, "Ajustements +count" 84). The shadcn TabsTrigger
 *   carries `whitespace-nowrap`, so the labels clipped mid-word with no
 *   scroll affordance.
 *
 * These tests pin:
 *   1. The financial TabsList scrolls horizontally below sm
 *      (`flex w-full overflow-x-auto …` — the codebase's established
 *      mobile chip-row idiom, used by the calendar filters and the
 *      StudentSwitcher) and restores the equal grid at sm+
 *      (`sm:grid sm:grid-cols-5`).
 *   2. The triggers' base `flex-1` (flex-basis: 0) is neutralized in
 *      flex mode (`basis-auto` + `shrink-0` on the trigger slot) —
 *      without this the five triggers still compress to equal widths
 *      inside the scroll container instead of sizing to content.
 *   3. The regression shape: the bare `grid w-full grid-cols-5`
 *      attribute (no mobile mode) is gone.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

const FINANCIAL = readFileSync(
  join(SRC, "features/financial/financial-view.tsx"),
  "utf8",
);

describe("T-202 — financial tab bar scrolls below sm (UI-303)", () => {
  it("the TabsList is a scrollable row below sm and the equal grid at sm+", () => {
    expect(FINANCIAL).toMatch(
      /className="flex w-full overflow-x-auto scrollbar-none sm:grid sm:grid-cols-5/,
    );
  });

  it("the triggers size to content in flex mode (basis-auto + shrink-0)", () => {
    expect(FINANCIAL).toMatch(
      /\[&_\[data-slot=tabs-trigger\]\]:basis-auto/,
    );
    expect(FINANCIAL).toMatch(
      /\[&_\[data-slot=tabs-trigger\]\]:shrink-0/,
    );
  });

  it("the pre-fix bare 5-cell grid attribute is gone", () => {
    expect(FINANCIAL).not.toMatch(
      /className="grid w-full grid-cols-5"/,
    );
  });
});
