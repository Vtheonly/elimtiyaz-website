/**
 * T-212 regression tests — full "Trimestre 1 / 2 / 3" labels replace the
 * T1/T2/T3 abbreviations throughout the portal (owner mandate, 32nd
 * session 2026-09-07: "instead of displaying abbreviated labels such as
 * T1, T2, and T3, use the full labels Trimester 1, Trimester 2, and
 * Trimester 3 throughout the portal"). The portal's UI language is French
 * → the full label is "Trimestre N" (the bulletin PDF already printed the
 * full form — only the academic view's tab triggers, its per-assessment
 * chips and the term KPI used the abbreviations).
 *
 * These tests pin:
 *   1. The abbreviated render shapes are GONE from the view source
 *      (`>T1<` triggers, `T{a.term}` chips, `` `T${activeTerm}` `` KPI).
 *   2. The full label is derived from the localized "student.term" key
 *      (fr: "Trimestre" → "Trimestre 2"), never a hardcoded string.
 *   3. The tab bar keeps the t-202 mobile pattern now that the labels are
 *      ~70–85px wide (scroll below sm, equal grid at sm+).
 *   4. The "all" option renders through the dictionary (the hardcoded
 *      French "Toutes" in an ar/en-capable UI is fixed with it).
 *   5. The bulletin PDF keeps its full "Trimestre ${term}" headings.
 *   6. The canonical AcademicTerm type ("T1" | "T2" | "T3") stays a
 *      DATA-level union (verbatim desktop port, parity-pinned) — the fix
 *      is display-layer only, no canonical-model change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dictionaries } from "@/lib/i18n/dictionary";
import { fullTermLabel } from "@/features/academic/academic-view";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

const ACADEMIC = read("features/academic/academic-view.tsx");
const BULLETIN = read("lib/bulletin.ts");
const CANONICAL_MODEL = read("lib/canonical/model/academic.ts");

const t = (key: string) => (dictionaries.fr as Record<string, string>)[key] ?? key;

describe("T-212 — full Trimestre labels (no T1/T2/T3 abbreviations)", () => {
  it("the abbreviated render shapes are gone from the academic view", () => {
    expect(ACADEMIC).not.toMatch(/>T1</);
    expect(ACADEMIC).not.toMatch(/>T2</);
    expect(ACADEMIC).not.toMatch(/>T3</);
    expect(ACADEMIC).not.toMatch(/T\{a\.term\}/);
    expect(ACADEMIC).not.toMatch(/`T\$\{activeTerm\}`/);
    // The hardcoded French "Toutes" (in an ar/en-capable UI) is gone too.
    expect(ACADEMIC).not.toMatch(/"Toutes"|>Toutes</);
  });

  it("every surface renders through the localized full-term helper", () => {
    expect(ACADEMIC).toContain("export function fullTermLabel(");
    // Tab triggers + per-assessment chips + the term KPI.
    expect(ACADEMIC).toMatch(/fullTermLabel\(t, n\)/);
    expect(ACADEMIC).toMatch(/fullTermLabel\(t, a\.term\)/);
    expect(ACADEMIC).toMatch(/fullTermLabel\(t, activeTerm\)/);
  });

  it("fullTermLabel produces the localized full label", () => {
    expect(fullTermLabel(t, 1)).toBe("Trimestre 1");
    expect(fullTermLabel(t, 2)).toBe("Trimestre 2");
    expect(fullTermLabel(t, 3)).toBe("Trimestre 3");
  });

  it("the tab bar keeps the t-202 mobile pattern for the wider labels", () => {
    expect(ACADEMIC).toMatch(
      /className="flex w-full overflow-x-auto scrollbar-none sm:grid sm:grid-cols-4/,
    );
    expect(ACADEMIC).toMatch(/\[&_\[data-slot=tabs-trigger\]\]:basis-auto/);
    expect(ACADEMIC).not.toMatch(/className="grid w-full grid-cols-4"/);
  });

  it("the dictionary carries the keys in all three locales", () => {
    for (const locale of ["fr", "ar", "en"] as const) {
      const dict = dictionaries[locale] as Record<string, string>;
      expect(dict["student.term"], `${locale} student.term`).toBeTruthy();
      expect(dict["academic.terms.all"], `${locale} academic.terms.all`).toBeTruthy();
    }
  });

  it("the bulletin PDF keeps its full Trimestre headings", () => {
    expect(BULLETIN).toMatch(/Trimestre \$\{term\}/);
  });

  it("the canonical AcademicTerm union is untouched (display-layer fix only)", () => {
    expect(CANONICAL_MODEL).toContain('export type AcademicTerm = "T1" | "T2" | "T3";');
  });
});
