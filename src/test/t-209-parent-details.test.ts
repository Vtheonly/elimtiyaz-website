/**
 * T-209 regression tests — the portal's parent personal-details enrichment
 * (owner mandate, 32nd session 2026-09-07: "not enough detailed information
 * about … the parents' personal details").
 *
 * Before T-209 the Profile account card rendered only email / name / phone
 * / status. The identity fields the canonical `parents` row carries
 * (relationship, national_id — fetched by the AuthProvider's `parents.*`
 * select since day one) were never displayed anywhere in the portal.
 *
 * These source-scan tests pin:
 *   1. The account card renders relationship, national id, parent code and
 *      member-since rows (staff-controlled identity, read-only — the 0027
 *      self-update trigger forbids editing them; the editable contact set
 *      stays in ParentContactEditCard).
 *   2. Relationship values render through a localized label map (never raw
 *      English enums), covering the canonical CHECK constraint (0005).
 *   3. Every new key exists in ALL THREE locales (fr / ar / en), exactly
 *      once per locale block.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

const PROFILE_VIEW = read("features/profile/profile-view.tsx");

const T209_KEYS = [
  "profile.relationship",
  "profile.relationship.father",
  "profile.relationship.mother",
  "profile.relationship.guardian",
  "profile.relationship.other",
  "profile.nationalId",
  "profile.memberSince",
  "profile.parentCode",
];

describe("T-209 — parent personal details render in the Profile account card", () => {
  it("renders relationship, national id, parent code and member-since rows", () => {
    expect(PROFILE_VIEW).toContain('t("profile.relationship")');
    expect(PROFILE_VIEW).toContain('t("profile.nationalId")');
    expect(PROFILE_VIEW).toContain('t("profile.parentCode")');
    expect(PROFILE_VIEW).toContain('t("profile.memberSince")');
    // member since renders through the shared formatDate (no inline date
    // formatting — the canonical format layer).
    expect(PROFILE_VIEW).toContain("formatDate(parent.created_at)");
  });

  it("relationship values map through the localized label map, not raw enums", () => {
    // The CHECK constraint values (0005) must all have a label-key entry in
    // the map (map keys are unquoted identifiers).
    for (const rel of ["father", "mother", "guardian", "other"]) {
      expect(PROFILE_VIEW).toContain(`${rel}: "profile.relationship.`);
    }
    expect(PROFILE_VIEW).toMatch(/relationshipLabels\[parent\.relationship\]/);
  });

  it("every T-209 key exists in all three locale blocks, once per locale", () => {
    const dict = read("lib/i18n/dictionary.ts");
    for (const key of T209_KEYS) {
      const occurrences = dict.split(`"${key}":`).length - 1;
      expect(occurrences, `"${key}" must exist exactly 3 times (fr/ar/en)`).toBe(3);
    }
  });
});
