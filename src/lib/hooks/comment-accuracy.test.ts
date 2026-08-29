import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * T-065 (WEAK-023 + DRIFT-010) — comment-accuracy guards.
 *
 * Both defects were SOURCE COMMENTS that contradicted the code they sat on:
 *  - WEAK-023: `useUnreadChatCount`'s comment claimed "the latest 200
 *    messages per channel" while the query fetches the latest 500 rows
 *    TOTAL (no channel filter) — the count is a lower bound.
 *  - DRIFT-010: `attendance-view.tsx`'s header claimed "The portal CANNOT
 *    submit justifications — that's a desktop workflow" while the view
 *    imports, renders and wires AbsenceJustificationDialog (the portal
 *    DOES submit).
 *
 * These scans pin the corrected wording so the misleading claims cannot
 * quietly return (same technique as the desktop T-001 credential guard and
 * the Android T-002 email-inference guard). They are intentionally
 * narrow: they match only the specific stale phrases, not general text.
 */

function readSource(relativePath: string): string {
  // Resolve from the process cwd (vitest runs from the repo root), walking
  // up a couple of levels for robustness in nested workspaces.
  let dir = process.cwd();
  for (let i = 0; i < 3; i++) {
    try {
      return readFileSync(path.join(dir, relativePath), "utf8");
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error(
    `source file not found from ${process.cwd()}: ${relativePath}`
  );
}

describe("comment accuracy (T-065)", () => {
  it("WEAK-023 — useUnreadChatCount no longer claims 'per channel' fetching", () => {
    const source = readSource("src/lib/hooks/portal-queries.ts");
    const staleClaims = [
      "200 messages per channel",
      "latest 200 messages per channel",
    ];
    for (const claim of staleClaims) {
      expect(
        source.includes(claim),
        `stale comment re-introduced in portal-queries.ts: "${claim}" — the query fetches the latest 500 rows TOTAL with no channel filter; update the comment to match the code (WEAK-023)`
      ).toBe(false);
    }
    // The corrected wording must be present.
    expect(source).toContain("Accuracy note (WEAK-023");
  });

  it("DRIFT-010 — attendance-view no longer claims the portal cannot submit justifications", () => {
    const source = readSource("src/features/attendance/attendance-view.tsx");
    // The view genuinely wires the submit path — the stale claim must stay
    // out, and the feature itself must stay wired.
    expect(
      source.includes("CANNOT submit justifications"),
      "stale comment re-introduced in attendance-view.tsx: the portal DOES submit justifications via AbsenceJustificationDialog (DRIFT-010)"
    ).toBe(false);
    expect(source).toContain("DRIFT-010 accuracy note");
    // Guard the code side too: if the dialog wiring is ever removed, the
    // comment must be rewritten — this assertion keeps them honest together.
    expect(source).toContain("AbsenceJustificationDialog");
  });
});
