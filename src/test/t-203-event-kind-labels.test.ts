/**
 * T-203 regression tests — the dashboard renders LOCALIZED calendar event
 * labels through the single canonical mapping (UI-304: raw English enums).
 *
 * The defect (live-render evidence 2026-09-06, 31st session):
 *   the dashboard's upcoming-events section rendered the raw backend enum
 *   (`<StatusPill>{ev.kind}</StatusPill>` → "meeting"/"reminder" — English
 *   strings in an otherwise French UI), while calendar-view.tsx held a
 *   private kindToUiType map + `calendar.eventType.*` localized labels.
 *   Same data, two renderings.
 *
 * These tests pin:
 *   1. The dashboard imports the shared mapping (no raw `{ev.kind}` render).
 *   2. The canonical mapping lives in ONE module (event-kind.ts) and
 *      calendar-view CONSUMES it (no re-declared local map — the
 *      duplicate-implementation guard this codebase's audits demand).
 *   3. The mapping's behavior: every backend kind resolves to a localized
 *      label key; unknown kinds fall back to "other"; 'payment' maps to
 *      the 'deadline' label (the calendar view's established convention).
 *   4. The label keys actually exist in the dictionary (fr) — a mapping
 *      change that invents a key without translating it fails here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  kindToUiType,
  eventKindLabelKey,
  uiTypeLabelKey,
} from "@/features/calendar/event-kind";
import { dictionaries } from "@/lib/i18n/dictionary";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

const DASHBOARD = readFileSync(
  join(SRC, "features/dashboard/dashboard-view.tsx"),
  "utf8",
);
const CALENDAR = readFileSync(
  join(SRC, "features/calendar/calendar-view.tsx"),
  "utf8",
);

describe("T-203 — dashboard renders localized event labels via the canonical map (UI-304)", () => {
  it("the dashboard imports and uses the shared label-key helper", () => {
    expect(DASHBOARD).toMatch(
      /import \{ eventKindLabelKey \} from "@\/features\/calendar\/event-kind"/,
    );
    expect(DASHBOARD).toMatch(/t\(eventKindLabelKey\(ev\.kind\)\)/);
    // The raw-enum RENDER (JSX text node) must be gone — the comment
    // documenting the old defect may legitimately name it, so the probe
    // matches the JSX shape specifically.
    expect(DASHBOARD).not.toMatch(/>{ev\.kind}</);
  });

  it("calendar-view consumes the shared map (no locally re-declared kindToUiType)", () => {
    expect(CALENDAR).toMatch(
      /import \{ kindToUiType, uiTypeLabelKey \} from "@\/features\/calendar\/event-kind"/,
    );
    // The old private declaration must be gone (duplicate-implementation
    // guard — the map must exist exactly once in the codebase).
    expect(CALENDAR).not.toMatch(/const kindToUiType: Record/);
  });

  it("every backend kind maps to a localized label; unknown kinds fall back", () => {
    const kinds = [
      "meeting",
      "reminder",
      "custom",
      "payment_received",
      "follow_up_call",
      "audit_log",
      "expense_event",
    ];
    for (const kind of kinds) {
      expect(kindToUiType[kind]).toBeTruthy();
      expect(eventKindLabelKey(kind)).toMatch(/^calendar\.eventType\./);
    }
    expect(eventKindLabelKey("nonexistent_kind")).toBe("calendar.eventType.other");
    // The payment→deadline label convention (calendar view's rule).
    expect(eventKindLabelKey("payment_received")).toBe("calendar.eventType.deadline");
    expect(uiTypeLabelKey("payment")).toBe("calendar.eventType.deadline");
  });

  it("all mapped label keys exist in the French dictionary", () => {
    const fr = dictionaries.fr as Record<string, string>;
    for (const uiType of new Set(Object.values(kindToUiType))) {
      const key = uiTypeLabelKey(uiType);
      expect(fr[key], `missing dictionary entry: ${key}`).toBeTruthy();
    }
  });
});
