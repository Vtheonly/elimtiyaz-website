/**
 * T-213 regression tests — the dashboard's children cards carry real
 * detail (owner mandate, 32nd session: the children information gap
 * applied portal-wide, and the dashboard is the first screen parents
 * see — it showed name + student_code only).
 *
 * These tests pin:
 *   1. The single-child dashboard card renders the level · class line
 *      and the enrollment-status pill (tone + label from the SHARED maps
 *      in children-info-card.tsx — one derivation, no second map).
 *   2. The level/class label derivation lives ONCE in
 *      features/students/child-summary.ts and BOTH the dashboard card
 *      and the profile card consume it (the duplicate-implementation
 *      guard — the exact UI-304 lesson: same data, two renderings).
 *   3. The helper behavior: joins year_label + grade_code, falls back to
 *      class code when name is null, appends room, and returns null for
 *      missing references.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { childLevelLabel, childClassLabel, childLevelClassLine } from "@/features/students/child-summary";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

const DASHBOARD = read("features/dashboard/dashboard-view.tsx");
const CHILDREN_CARD = read("features/profile/children-info-card.tsx");
const SUMMARY = read("features/students/child-summary.ts");

const levels = [
  { id: "lvl-1", year_label: "1ère Année Primaire", grade_code: "1ap" },
  { id: "lvl-2", year_label: "2ème Année Primaire", grade_code: "2ap" },
] as never[];

const klass = { id: "cls-1", name: "1ère Année Moyenne", code: "CLS-1AM", room: "B12" } as never;

describe("T-213 — dashboard children cards enrichment", () => {
  it("the single-child card renders level·class + the enrollment status pill", () => {
    expect(DASHBOARD).toContain("childLevelClassLine(levels.data, klass.data, kid)");
    expect(DASHBOARD).toMatch(/enrollmentStatusTone\[kid\.enrollment_status\]/);
    expect(DASHBOARD).toMatch(/enrollmentStatusLabels\[kid\.enrollment_status\]/);
    expect(DASHBOARD).toContain('setActiveView("academic")');
  });

  it("the dashboard imports the SHARED maps (no second status-map derivation)", () => {
    expect(DASHBOARD).toContain(
      'import {\n  enrollmentStatusLabels,\n  enrollmentStatusTone,\n} from "@/features/profile/children-info-card"',
    );
  });

  it("the profile card consumes the same shared summary helpers", () => {
    expect(CHILDREN_CARD).toContain(
      'import { childLevelLabel, childClassLabel } from "@/features/students/child-summary"',
    );
    // The inline derivation is gone (it lived in ChildIdentityCard).
    expect(CHILDREN_CARD).not.toContain("[level.year_label, level.grade_code]");
    expect(CHILDREN_CARD).not.toContain("[klass.data.name ?? klass.data.code, klass.data.room]");
  });

  it("child-summary is the ONLY level/class join derivation", () => {
    expect(SUMMARY).toContain("export function childLevelLabel(");
    expect(SUMMARY).toContain("export function childClassLabel(");
    expect(SUMMARY).toContain("export function childLevelClassLine(");
  });
});

describe("T-213 — child-summary behavior", () => {
  it("joins year_label + grade_code; either part alone survives", () => {
    expect(childLevelLabel(levels, "lvl-1")).toBe("1ère Année Primaire · 1ap");
    expect(
      childLevelLabel([{ id: "lvl-x", year_label: null, grade_code: "GS" } as never], "lvl-x"),
    ).toBe("GS");
    expect(childLevelLabel(levels, "unknown")).toBeNull();
    expect(childLevelLabel(null, "lvl-1")).toBeNull();
  });

  it("class label prefers name over code and appends the room", () => {
    expect(childClassLabel(klass)).toBe("1ère Année Moyenne · B12");
    expect(childClassLabel({ ...klass, name: null } as never)).toBe("CLS-1AM · B12");
    expect(childClassLabel({ ...klass, room: null } as never)).toBe("1ère Année Moyenne");
    expect(childClassLabel(null)).toBeNull();
  });

  it("the combined line omits missing halves", () => {
    expect(childLevelClassLine(levels, klass, { grade_level_id: "lvl-2" })).toBe(
      "2ème Année Primaire · 2ap · 1ère Année Moyenne · B12",
    );
    expect(childLevelClassLine(null, null, { grade_level_id: null })).toBeNull();
    expect(childLevelClassLine(null, klass, { grade_level_id: null })).toBe(
      "1ère Année Moyenne · B12",
    );
  });
});
