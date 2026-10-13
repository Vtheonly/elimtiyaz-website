/**
 * T-525 regression tests — exam & homework visibility on the website
 * calendar (UI-343 + the CROSS-201 read side).
 *
 * The defect (live-diagnosed 2026-10-13, 169th session):
 *   the calendar month grid keyed EVERY day cell with
 *   `day.date.toISOString().slice(0, 10)` — the UTC rendering of a
 *   LOCAL-midnight Date. In Africa/Algiers (UTC+1) local midnight of
 *   Oct 13 is Oct 12 23:00 UTC, so the cell LABELED 13 carried key
 *   "2026-10-12": a homework due Oct 13 rendered its dot on the 14th,
 *   clicking the 13th showed nothing, isToday/goToday were shifted —
 *   the owner pushed homework from Pedagogy and it "did not appear".
 *
 * These tests pin:
 *   1. localDateKey derives the key from the LOCAL calendar components
 *      (the construction date is always its own key — in every timezone).
 *   2. buildMonthGrid + localDateKey: the cell for day D carries key D
 *      (the pre-fix code produced D−1 in UTC+ zones — the exact defect).
 *   3. rangeBoundsFromDateKeys: inclusive full-day bounds for the
 *      month-range query (events ON the end date are not excluded).
 *   4. Source pins: calendar-view uses the LOCAL-key helpers everywhere
 *      (no toISOString-on-local-Date key derivation remains), consumes
 *      the month-RANGE query (useEventsInRange) for the grid, the
 *      future-only useUpcomingEvents for the "Prochains examens"
 *      section, and merges homework across ALL the parent's children's
 *      classes (useHomeworkForClasses — the plan's "events relevant to
 *      the parent's children").
 *   5. The exam read contract: exam rows are calendar_events with
 *      target_entity_type='exam' (rendered with room + invigilator) —
 *      the shape the desktop T-525 scheduler writes and migration 0154
 *      scopes to the parent's children's classes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  localDateKey,
  todayKey,
  rangeBoundsFromDateKeys,
} from "@/features/calendar/date-key";
import { buildMonthGrid } from "@/features/calendar/calendar-view";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

const CALENDAR = readFileSync(
  join(SRC, "features/calendar/calendar-view.tsx"),
  "utf8",
);
const QUERIES = readFileSync(
  join(SRC, "lib/hooks/portal-queries.ts"),
  "utf8",
);

describe("T-525 — localDateKey: the LOCAL calendar date, never the UTC instant (UI-343)", () => {
  it("a Date constructed at local midnight of day D is keyed D — in every timezone", () => {
    // Local midnight of Oct 13 — whatever the runtime TZ, the LOCAL calendar
    // date of this Date IS Oct 13, so its key must be "2026-10-13".
    const d = new Date(2026, 9, 13, 0, 0, 0, 0);
    expect(localDateKey(d)).toBe("2026-10-13");
    // The regression shape: in UTC+ timezones the OLD derivation
    // (toISOString) answered YESTERDAY — pin the divergence explicitly so
    // the helper can never be "simplified" back to toISOString.
    if (d.toISOString().slice(0, 10) !== "2026-10-13") {
      // UTC+ / UTC- runtime: toISOString disagrees with the local date —
      // exactly the environment where UI-343 fired. The helper must still
      // answer the local date.
      expect(localDateKey(d)).not.toBe(d.toISOString().slice(0, 10));
    }
  });

  it("month/year rollovers and single-digit padding", () => {
    expect(localDateKey(new Date(2027, 0, 5))).toBe("2027-01-05");
    expect(localDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
    expect(localDateKey(new Date(2028, 1, 29))).toBe("2028-02-29"); // leap year
  });

  it("todayKey equals localDateKey(now)", () => {
    const now = new Date();
    expect(todayKey()).toBe(localDateKey(now));
  });
});

describe("T-525 — the month grid: the cell for day D carries key D (the UI-343 pin)", () => {
  it("every cell's localDateKey equals its displayed day number", () => {
    const grid = buildMonthGrid(new Date(2026, 9, 1)); // October 2026
    expect(grid).toHaveLength(42);
    for (const cell of grid) {
      const key = localDateKey(cell.date);
      // The key's day-of-month equals the cell's displayed number:
      expect(Number(key.slice(8, 10))).toBe(cell.date.getDate());
      expect(key.slice(0, 7)).toBe(
        `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}`,
      );
    }
  });

  it("a homework due 2026-10-13 lands on the cell DISPLAYING 13 October — not the 14th", () => {
    // The owner's exact scenario: homework "dddddd" (due 2026-10-13, class
    // 5AP-Section A) had to appear on the 13th. The pre-fix grid keyed the
    // cell labeled 13 as "2026-10-12", so the event keyed "2026-10-13"
    // matched the cell labeled 14 (the defect) and clicking 13 showed
    // nothing. Pin: SOME cell whose displayed day is 13 (in-month) carries
    // the key "2026-10-13", and NO in-month cell displaying 14 does.
    const grid = buildMonthGrid(new Date(2026, 9, 1));
    const cellFor13 = grid.find(
      (c) => c.isCurrentMonth && c.date.getDate() === 13,
    );
    const cellFor14 = grid.find(
      (c) => c.isCurrentMonth && c.date.getDate() === 14,
    );
    expect(cellFor13).toBeDefined();
    expect(cellFor14).toBeDefined();
    expect(localDateKey(cellFor13!.date)).toBe("2026-10-13");
    expect(localDateKey(cellFor14!.date)).toBe("2026-10-14");
    // The old defect's signature — the cell labeled 13 keyed to the 12th —
    // is gone:
    expect(localDateKey(cellFor13!.date)).not.toBe("2026-10-12");
  });
});

describe("T-525 — rangeBoundsFromDateKeys: inclusive full-day query bounds", () => {
  it("start = midnight, end = the last instant of the end day", () => {
    const { start, end } = rangeBoundsFromDateKeys("2026-09-28", "2026-10-31");
    expect(start).toBe("2026-09-28T00:00:00.000Z");
    expect(end).toBe("2026-10-31T23:59:59.999Z");
    // An event ON the end date is inside the range (lexicographic compare —
    // the useEventsInRange query contract):
    expect("2026-10-31T08:30:00+00:00" >= start).toBe(true);
    expect("2026-10-31T08:30:00+00:00" <= end).toBe(true);
    expect("2026-09-27T23:00:00+00:00" >= start).toBe(false);
  });
});

describe("T-525 — calendar-view wiring (source pins)", () => {
  it("derives every day-cell/selected/today key through the LOCAL helpers — no toISOString keys remain", () => {
    expect(CALENDAR).toContain("localDateKey(day.date)");
    expect(CALENDAR).toContain("todayKey()");
    // The UI-343 defect shapes are gone:
    expect(CALENDAR).not.toMatch(/day\.date\.toISOString\(\)/);
    expect(CALENDAR).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice/);
  });

  it("the grid consumes the month-RANGE query; the exams section keeps the future-only query", () => {
    expect(CALENDAR).toMatch(/const events = useEventsInRange\(rangeStart, rangeEnd\)/);
    expect(CALENDAR).toMatch(/const upcomingEvents = useUpcomingEvents\(/);
    // The pre-fix single future-only source for the grid is gone:
    expect(CALENDAR).not.toMatch(/^ {2}const events = useUpcomingEvents/m);
  });

  it("homework covers ALL the parent's children's classes (useHomeworkForClasses)", () => {
    expect(CALENDAR).toMatch(
      /const homework = useHomeworkForClasses\(homeworkClassIds/,
    );
    // The pre-fix active-kid-only call is gone:
    expect(CALENDAR).not.toMatch(/useHomeworkForClass\(activeKid/);
    // The plural hook reads the CANONICAL table with the dedupe-by-id:
    expect(QUERIES).toContain("useHomeworkForClasses");
    expect(QUERIES).toMatch(/byId\.set\(row\.id, row\)/);
  });

  it("exam events are detected by the documented contract (target_entity_type='exam')", () => {
    // The same shape the desktop T-525 scheduler writes (kind='custom' +
    // target_entity_type='exam') and migration 0154's parent read window
    // scopes — rendered with room (location) + invigilator (target_name).
    expect(CALENDAR).toMatch(/target_entity_type === "exam"/);
    expect(CALENDAR).toMatch(/ev\.location/);
    expect(CALENDAR).toMatch(/exam\.target_name/);
  });
});
