/**
 * Calendar date-key helpers — T-525 (UI-343).
 *
 * The calendar month grid keys every day cell by a LOCAL calendar date
 * (YYYY-MM-DD). Deriving that key with `Date.toISOString()` is WRONG in
 * every UTC+ timezone: toISOString renders the UTC instant, and local
 * midnight in Africa/Algiers (UTC+1) is 23:00 UTC of the PREVIOUS day —
 * so every cell was keyed one day early, events landed on the wrong cell,
 * and clicking the due date showed nothing (the UI-343 root cause).
 *
 * These helpers derive the key from the LOCAL calendar components
 * (getFullYear/getMonth/getDate) — correct in every timezone. Event data
 * keys (hw.due_date, installments.due_date, calendar_events.start_at) are
 * ALREADY plain YYYY-MM-DD / ISO strings from the backend and need no
 * conversion.
 */

/** The LOCAL calendar date key (YYYY-MM-DD) of a Date — never toISOString. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The LOCAL calendar date key of "now". */
export function todayKey(): string {
  return localDateKey(new Date());
}

/**
 * The inclusive [start, end] ISO bounds covering a span of LOCAL date keys —
 * used with `useEventsInRange` (whose query compares timestamptz strings).
 * The end bound carries the full last day (23:59:59.999Z) so events ON the
 * end date are not lexicographically excluded.
 */
export function rangeBoundsFromDateKeys(startKey: string, endKey: string): {
  start: string;
  end: string;
} {
  return { start: `${startKey}T00:00:00.000Z`, end: `${endKey}T23:59:59.999Z` };
}
